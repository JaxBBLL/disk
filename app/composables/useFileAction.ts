import type { ComputedRef, Ref } from 'vue'
import type {
  ApiResponse,
  CreateBody,
  DeleteBody,
  FileItem,
  MoveBody,
  MoveResult,
  RenameBody,
  UploadResult
} from '#shared/types'
import { toast } from '~/composables/useToast'
import { useDialog } from '~/composables/useDialog'
import { ILLEGAL_NAME_CHARS, downloadByUrl, selectFiles, selectFolder } from '~/utils/file'
import { reportError } from '~/utils/error'
import type { DropItem } from '~/utils/file'

/** 目录路径 → 查询参数值。同时接受路径片段数组或已拼接的字符串 */
const encodePaths = (segments: string | string[]): string =>
  encodeURIComponent(
    (Array.isArray(segments) ? segments : [segments]).filter(Boolean).join('/')
  )

/** ofetch 选项的最小子集，只涵盖本项目用到的字段 */
interface RequestOptions {
  method?: 'POST' | 'GET'
  body?: Record<string, unknown> | FormData
}

export interface UseFileActionOptions {
  /** 当前目录路径片段 */
  paths: ComputedRef<string[]>
  /** 操作后刷新列表 */
  refresh: () => Promise<void>
  /** 共享的忙碌状态，用于展示 loading */
  loading: Ref<boolean>
}

/**
 * 全部文件操作动作。
 * paths 为当前目录（ref），refresh 用于操作后刷新列表，loading 用于展示忙碌状态。
 */
export function useFileAction({ paths, refresh, loading }: UseFileActionOptions) {
  const busy = ref(false)
  const uploading = ref(false)
  const uploadingLabel = ref('')
  const { confirm, prompt } = useDialog()

  async function request<T>(url: string, options: RequestOptions): Promise<T | null> {
    try {
      return await $fetch<T>(url, options)
    } catch (error) {
      reportError(error)
      return null
    }
  }

  const setBusy = (value: boolean) => {
    busy.value = value
    if (loading) {
      loading.value = value
    }
  }

  /**
   * 统一的上传入口：items 为 [{ file, relativePath }]。
   * 按「目标目录」分组合并请求，大文件夹不会逐文件发请求。
   */
  async function uploadGrouped(items: DropItem[]): Promise<boolean> {
    if (!items?.length) {
      return false
    }

    const groups = new Map<string, File[]>()

    for (const { file, relativePath } of items) {
      const segments = String(relativePath ?? file.name).split('/').slice(0, -1)
      const key = [...paths.value, ...segments].filter(Boolean).join('/')
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(file)
    }

    setBusy(true)
    uploading.value = true
    uploadingLabel.value = `正在上传 ${items.length} 个文件…`

    let ok = true

    try {
      for (const [key, files] of groups) {
        const form = new FormData()
        for (const file of files) {
          form.append('files', file)
        }

        const res = await request<UploadResult>(`/api/upload?filePath=${encodePaths(key)}`, {
          method: 'POST',
          body: form
        })

        if (!res) {
          ok = false
        }
      }
    } finally {
      // 无论成功还是抛错，都必须复位状态，否则列表会永远转圈
      uploading.value = false
      setBusy(false)
    }

    if (ok) {
      toast.success(`已上传 ${items.length} 个文件`)
      await refresh()
    }

    return ok
  }

  /** 文件选择器返回的是 FileList 而非数组，这里统一转成数组再处理 */
  async function uploadFiles(files: FileList | File[]): Promise<boolean> {
    return uploadGrouped(
      Array.from(files || []).map((file) => ({ file, relativePath: file.name }))
    )
  }

  function pickAndUploadFiles(): void {
    selectFiles((files) => {
      void uploadFiles(files)
    })
  }

  /** 文件夹选择器，用 webkitRelativePath 还原层级 */
  function pickAndUploadFolder(): void {
    selectFolder((files) => {
      void uploadGrouped(
        (files || []).map((file) => ({
          file,
          relativePath: file.webkitRelativePath || file.name
        }))
      )
    })
  }

  /** 拖拽上传，支持整个文件夹（含目录层级） */
  const uploadDropped = (items: DropItem[]) => uploadGrouped(items)

  function downloadItems(items: FileItem[]): void {
    if (!items.length) {
      return
    }
    downloadByUrl(
      `/api/download?filePaths=${encodeURIComponent(
        JSON.stringify(items.map((item) => item.filePath))
      )}`
    )
  }

  function previewItem(item: FileItem): void {
    window.open(`/api/download/preview?filePath=${encodeURIComponent(item.filePath)}`)
  }

  async function renameItem(item: FileItem): Promise<void> {
    const lastIndex = item.name.lastIndexOf('.')
    const ext = lastIndex === -1 ? '' : item.name.slice(lastIndex)
    const base = lastIndex === -1 ? item.name : item.name.slice(0, lastIndex)

    const text = ((await prompt('请输入新名称', '重命名', base)) ?? '').trim()

    if (!text) {
      return
    }
    if (ILLEGAL_NAME_CHARS.test(text)) {
      toast.error('文件名包含非法字符')
      return
    }

    const res = await request<ApiResponse<boolean>>('/api/rename', {
      method: 'POST',
      body: { filePath: item.filePath, newName: text + ext } satisfies RenameBody
    })

    if (!res) {
      return
    }
    if (res.isExit) {
      toast.error(res.message ?? '目录存在相同文件名')
    } else {
      await refresh()
    }
  }

  async function createFolder(): Promise<void> {
    const text = ((await prompt('请输入文件夹名称', '新建文件夹')) ?? '').trim()

    if (!text) {
      return
    }
    if (ILLEGAL_NAME_CHARS.test(text)) {
      toast.error('文件名包含非法字符')
      return
    }

    const res = await request<ApiResponse>('/api/create', {
      method: 'POST',
      body: { filePath: paths.value, name: text } satisfies CreateBody
    })

    if (!res) {
      return
    }
    if (res.isExit) {
      toast.error('文件夹已存在')
    } else {
      toast.success('文件夹已创建')
      await refresh()
    }
  }

  async function removeItems(items: FileItem[]): Promise<void> {
    if (!items.length) {
      return
    }

    const names = items.map((item) => item.name).join('、')

    const ok = await confirm(`确定删除：${names}？`)

    if (!ok) {
      return
    }

    const res = await request<ApiResponse>('/api/delete', {
      method: 'POST',
      body: { filePaths: items.map((item) => item.filePath) } satisfies DeleteBody
    })

    if (res) {
      toast.success('已删除')
      await refresh()
    }
  }

  async function moveItems(items: FileItem[], newFolder: string): Promise<boolean> {
    if (!items.length) {
      return false
    }

    const res = await request<ApiResponse<MoveResult[]>>('/api/move', {
      method: 'POST',
      body: {
        filePaths: items.map((item) => item.filePath),
        newFolder
      } satisfies MoveBody
    })

    if (!res) {
      return false
    }

    if ((res.data || []).some((item) => item.isExit)) {
      toast.error('目录存在相同文件名')
    }

    await refresh()
    return true
  }

  return {
    busy,
    uploading,
    uploadingLabel,
    uploadFiles,
    uploadDropped,
    pickAndUploadFiles,
    pickAndUploadFolder,
    downloadItems,
    previewItem,
    renameItem,
    createFolder,
    removeItems,
    moveItems
  }
}
