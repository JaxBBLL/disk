import { useCallback, useState } from 'react'
import type {
  ApiResponse,
  CreateBody,
  DeleteBody,
  FileItem,
  MoveBody,
  MoveResult,
  RenameBody,
  UploadResult
} from '@/lib/types'
import { useDialog } from './dialog'
import { toast } from './toast'
import { apiFetch } from './request'
import { reportError } from './error'
import { ILLEGAL_NAME_CHARS, downloadByUrl, selectFiles, selectFolder } from './file'
import type { DropItem } from './file'

/** 目录路径 → 查询参数值。同时接受路径片段数组或已拼接的字符串 */
const encodePaths = (segments: string | string[]): string =>
  encodeURIComponent((Array.isArray(segments) ? segments : [segments]).filter(Boolean).join('/'))

export interface UseFileActionOptions {
  /** 当前目录路径片段 */
  paths: string[]
  /** 操作后刷新列表 */
  refresh: () => Promise<void>
  /** 共享的忙碌状态，用于展示 loading */
  setLoading: (value: boolean) => void
}

/**
 * 全部文件操作动作。
 * paths 为当前目录，refresh 用于操作后刷新列表，setLoading 用于展示忙碌状态。
 */
export function useFileAction({ paths, refresh, setLoading }: UseFileActionOptions) {
  const [busy, setBusyState] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingLabel, setUploadingLabel] = useState('')
  const { confirm, prompt } = useDialog()

  async function request<T>(
    url: string,
    options: { method?: 'POST' | 'GET'; body?: Record<string, unknown> | FormData }
  ): Promise<T | null> {
    try {
      return await apiFetch<T>(url, options)
    } catch (error) {
      reportError(error)
      return null
    }
  }

  const setBusy = useCallback(
    (value: boolean) => {
      setBusyState(value)
      setLoading(value)
    },
    [setLoading]
  )

  /**
   * 统一的上传入口：items 为 [{ file, relativePath }]。
   * 按「目标目录」分组合并请求，大文件夹不会逐文件发请求。
   */
  const uploadGrouped = useCallback(
    async (items: DropItem[]): Promise<boolean> => {
      if (!items?.length) {
        return false
      }

      const groups = new Map<string, File[]>()

      for (const { file, relativePath } of items) {
        const segments = String(relativePath ?? file.name).split('/').slice(0, -1)
        const key = [...paths, ...segments].filter(Boolean).join('/')
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)?.push(file)
      }

      setBusy(true)
      setUploading(true)
      setUploadingLabel(`正在上传 ${items.length} 个文件…`)

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
        setUploading(false)
        setBusy(false)
      }

      if (ok) {
        toast.success(`已上传 ${items.length} 个文件`)
        await refresh()
      }

      return ok
    },
    [paths, refresh, setBusy]
  )

  /** 文件选择器返回的是 FileList 而非数组，这里统一转成数组再处理 */
  const uploadFiles = useCallback(
    async (files: FileList | File[]): Promise<boolean> =>
      uploadGrouped(
        Array.from(files || []).map((file) => ({ file, relativePath: file.name }))
      ),
    [uploadGrouped]
  )

  const pickAndUploadFiles = useCallback(() => {
    selectFiles((files) => {
      void uploadFiles(files)
    })
  }, [uploadFiles])

  /** 文件夹选择器，用 webkitRelativePath 还原层级 */
  const pickAndUploadFolder = useCallback(() => {
    selectFolder((files) => {
      void uploadGrouped(
        (files || []).map((file) => ({
          file,
          relativePath: file.webkitRelativePath || file.name
        }))
      )
    })
  }, [uploadGrouped])

  /** 拖拽上传，支持整个文件夹（含目录层级） */
  const uploadDropped = useCallback(
    (items: DropItem[]) => uploadGrouped(items),
    [uploadGrouped]
  )

  const downloadItems = useCallback((items: FileItem[]): void => {
    if (!items.length) {
      return
    }
    downloadByUrl(
      `/api/download?filePaths=${encodeURIComponent(
        JSON.stringify(items.map((item) => item.filePath))
      )}`
    )
  }, [])

  const previewItem = useCallback((item: FileItem): void => {
    window.open(`/api/download/preview?filePath=${encodeURIComponent(item.filePath)}`)
  }, [])

  const renameItem = useCallback(
    async (item: FileItem): Promise<void> => {
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
    },
    [prompt, refresh]
  )

  const createFolder = useCallback(async (): Promise<void> => {
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
      body: { filePath: paths, name: text } satisfies CreateBody
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
  }, [paths, prompt, refresh])

  const removeItems = useCallback(
    async (items: FileItem[]): Promise<void> => {
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
    },
    [confirm, refresh]
  )

  const moveItems = useCallback(
    async (items: FileItem[], newFolder: string): Promise<boolean> => {
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
    },
    [refresh]
  )

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
