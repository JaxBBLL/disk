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
import { toast } from '~/ui/composables/useToast'
import { useDialog } from '~/ui/composables/useDialog'
import { ILLEGAL_NAME_CHARS, downloadByUrl, selectFiles, selectFolder } from '~/utils/file'
import { reportError } from '~/utils/error'
import type { DropItem } from '~/utils/file'
import { shouldChunk, uploadInChunks } from '~/utils/chunked-upload'

/** 目录路径 → 查询参数值。同时接受路径片段数组或已拼接的字符串 */
const encodePaths = (segments: string | string[]): string =>
  encodeURIComponent(
    (Array.isArray(segments) ? segments : [segments]).filter(Boolean).join('/')
  )

/** ofetch 选项的最小子集，只涵盖本项目用到的字段 */
interface RequestOptions {
  method?: 'POST' | 'GET'
  body?: Record<string, unknown> | FormData
  onUploadProgress?: (event: { loaded: number; total?: number }) => void
  signal?: AbortSignal
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
  const uploading = ref(false)
  const uploadingLabel = ref('')
  /** 上传进度 0–100；上传结束后短暂 100%，finally 中归零 */
  const uploadingProgress = ref(0)
  /**
   * 当前批次上传的 AbortController。null 表示没有上传在进行。
   * cancelUpload() 调用时 abort() 会让所有进行中的 $fetch 立刻 reject，
   * 后端 busboy 的 'aborted' / 'close' 监听会把已写入的半成品文件清理掉。
   */
  const uploadingAbort = ref<AbortController | null>(null)
  /**
   * 当前批次产生的所有 uploadId（来自大文件分片上传）。
   * cancelUpload() 时除了 abort 信号，还会 fire-and-forget 调
   * /api/upload/cancel 让服务端清掉对应的临时目录。
   * uploadId 由服务端按时间戳+随机+序号生成，全机器唯一，
   * 多用户并发下每个 tab/window 各自独立，互不影响。
   */
  const uploadingUploadIds = new Set<string>()
  const { confirm, prompt } = useDialog()

  async function request<T>(url: string, options: RequestOptions): Promise<T | null> {
    try {
      return await $fetch<T>(url, options as Parameters<typeof $fetch<T>>[1])
    } catch (error) {
      // 用户主动取消时不要弹错误 toast（前端已经在 finally 中清理）
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'AbortError'
      ) {
        return null
      }
      reportError(error)
      return null
    }
  }

  /** 中断当前批次的所有上传请求；幂等（无进行中时调用安全） */
  function cancelUpload(): void {
    uploadingAbort.value?.abort()
    // 通知服务端清掉本次批次产生的所有 uploadId 对应的临时目录。
    // 用原生 fetch 而非 $fetch：$fetch 无法在 signal 已 abort 的情况下再发请求，
    // 而 cancel 触发的清理请求不能被主 controller 的 abort 误伤。
    // keepalive: true 保证即使页面立刻关闭，清理请求也会到达服务端。
    const ids = Array.from(uploadingUploadIds)
    uploadingUploadIds.clear()
    for (const uploadId of ids) {
      try {
        fetch('/api/upload/cancel', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadId }),
          keepalive: true
        }).catch(() => {})
      } catch {
        // fire-and-forget；服务端清理失败不影响前端状态
      }
    }
  }

  /**
   * 统一的上传入口：items 为 [{ file, relativePath }]。
   * 按「目标目录」分组合并请求，多目录并发上传（不串行）。
   * 进度通过 $fetch 的 onUploadProgress 累加到 uploadingLabel。
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

    uploading.value = true
    loading.value = true
    uploadingProgress.value = 0
    uploadingLabel.value = `准备上传 ${items.length} 个文件…`

    // 每次新批次都创建新的 controller；cancelUpload() 用它一并中断所有 $fetch
    const controller = new AbortController()
    uploadingAbort.value = controller

    const totalBytes = items.reduce((sum, { file }) => sum + (file.size || 0), 0)
    let loadedBytes = 0

    /**
     * 把全批次已发字节换算成 0–99 的进度百分比。
     * 故意不到 100：最后一组完成才置 100，让动画看起来是「走完而不是跳」。
     */
    function syncProgress() {
      if (!totalBytes) {
        // 无法按字节估算（全是 0 字节文件等）：保持 0，由调用方在完成时统一推到 100。
        // 不要在这里编造百分比，否则会出现「恒为 0」或虚假跳变。
        return
      }
      const pct = Math.round((loadedBytes / totalBytes) * 100)
      uploadingProgress.value = Math.min(99, Math.max(0, pct))
    }

    /**
     * 上传一个目录分组：
     * - 小文件（< 5MB）走单次 FormData 上传（/api/upload），一次提交同组所有文件
     * - 大文件走分片上传（/api/upload/init + chunk + merge），单文件串行
     *
     * 同一分组里小文件 + 大文件混合：先批量发小的，再逐个发大的。
     * 每组内 lastLoaded 用于把 ofetch 的「本组累计字节」换算成「本组新增字节」；
     * 单个大文件内部 onProgress 也按同样思路累加（维护 per-file lastLoaded）。
     */
    const uploadOneGroup = async ([key, files]: [string, File[]]): Promise<boolean> => {
      const small = files.filter((f) => !shouldChunk(f.size || 0))
      const big = files.filter((f) => shouldChunk(f.size || 0))

      let ok = true
      const mb = (n: number) => (n / 1048576).toFixed(1)
      const updateLabel = () => {
        uploadingLabel.value = totalBytes
          ? `已上传 ${mb(loadedBytes)} / ${mb(totalBytes)} MB`
          : `已上传 ${items.length} 个文件…`
      }

      // ---- 小文件：原单次 FormData 上传 ----
      if (small.length) {
        const form = new FormData()
        for (const file of small) {
          form.append('files', file)
        }

        const groupTotal = small.reduce((sum, f) => sum + (f.size || 0), 0)
        let lastLoaded = 0

        const res = await request<UploadResult>(`/api/upload?filePath=${encodePaths(key)}`, {
          method: 'POST',
          body: form,
          signal: controller.signal,
          onUploadProgress: (event) => {
            const delta = event.loaded - lastLoaded
            lastLoaded = event.loaded
            loadedBytes += delta
            updateLabel()
            syncProgress()
          }
        })

        if (lastLoaded === 0) {
          loadedBytes += groupTotal
        } else if (lastLoaded < groupTotal) {
          loadedBytes += groupTotal - lastLoaded
        }
        syncProgress()

        if (!res) ok = false
      }

      // ---- 大文件：分片上传 ----
      for (const file of big) {
        const fileSize = file.size || 0
        let lastFileLoaded = 0
        let fileUploadId: string | undefined
        let failed = false
        try {
          const result = await uploadInChunks({
            file,
            filePath: key.split('/').filter(Boolean),
            signal: controller.signal,
            onProgress: (loaded) => {
              const safe = Math.min(loaded, fileSize)
              const delta = safe - lastFileLoaded
              lastFileLoaded = safe
              loadedBytes += delta
              updateLabel()
              syncProgress()
            },
            // 一旦 init 返回 uploadId 立刻登记，cancelUpload 才能遍历到
            onUploadId: (id) => {
              fileUploadId = id
              uploadingUploadIds.add(id)
            }
          })

          if (!result.savedName) {
            failed = true
            ok = false
          } else {
            // merge 成功：服务端已自动 cleanup 临时目录
            uploadingUploadIds.delete(result.uploadId)
          }
        } catch (error) {
          failed = true
          ok = false
          // uploadInChunks 失败时把 uploadId 挂到 error 上；
          // 也可能根本没拿到（init 阶段就 abort），此时 fileUploadId 仍 undefined。
          const errUploadId =
            (typeof error === 'object' &&
              error !== null &&
              'uploadId' in error &&
              (error as { uploadId?: string }).uploadId) ||
            undefined
          if (errUploadId) fileUploadId = errUploadId

          const isAbort =
            (error instanceof DOMException && error.name === 'AbortError') ||
            (typeof error === 'object' &&
              error !== null &&
              'name' in error &&
              (error as { name?: string }).name === 'AbortError')

          if (!isAbort) {
            reportError(error)
          }
        } finally {
          // 失败（非 cancel 触发的）且 uploadId 仍在 set 里 → 主动发 cancel POST
          // 触发服务端清理孤儿临时目录。
          // （cancel 触发的失败：cancelUpload 会统一处理）
          if (failed && fileUploadId && uploadingUploadIds.has(fileUploadId)) {
            fetch('/api/upload/cancel', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ uploadId: fileUploadId }),
              keepalive: true
            }).catch(() => {})
            uploadingUploadIds.delete(fileUploadId)
          }
        }
      }

      // 最后再刷新一次 label（防止大文件最后一次 onProgress 后整体进度对齐）
      updateLabel()

      return ok
    }

    let ok = true
    let cancelled = false

    try {
      const results = await Promise.allSettled(
        Array.from(groups, (entry) => uploadOneGroup(entry))
      )

      cancelled = controller.signal.aborted
      ok = !cancelled && results.every((r) => r.status === 'fulfilled' && r.value === true)
      if (!cancelled) {
        // 所有组都跑完（且没被取消）：进度推到 100% 让 UI 看到「完成」动画再归零
        uploadingProgress.value = 100
      }
    } finally {
      // 短暂保留 100% 让眼睛看到，再归零；取消时不走这段以免进度条满一下又归零
      setTimeout(() => {
        uploading.value = false
        loading.value = false
        uploadingProgress.value = 0
      }, cancelled ? 0 : 250)
      uploadingAbort.value = null
    }

    if (cancelled) {
      // 用户取消：不弹成功 toast，给一个轻提示；后端 busboy 已经回滚半成品
      toast.info(`已取消上传（${items.length} 个文件）`)
      // 取消后刷新列表：本次批次可能已经写入了部分小文件（< 5MB 的 FormData
      // 单次上传可能在 abort 之前就完成），或者部分大文件分片已落地。
      // 无论哪种情况，列表当前状态都可能是过时的，需要刷新一次。
      await refresh().catch(() => {})
      return false
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

    const results = res.data || []
    const conflicts = results.filter((item) => item.isExit)
    const failures = results.filter((item) => !item.isExit && item.code !== 200)

    if (conflicts.length) {
      toast.error('目录存在相同文件名')
    }
    if (failures.length) {
      // 部分条目移动失败（权限 / 磁盘错误等），必须让用户知道，不能静默吞掉
      toast.error(`${failures.length} 项移动失败：${failures[0]?.message ?? '未知错误'}`)
    }
    if (!conflicts.length && !failures.length) {
      toast.success('移动成功')
    }

    await refresh()
    return conflicts.length === 0 && failures.length === 0
  }

  return {
    uploading,
    uploadingLabel,
    uploadingProgress,
    cancelUpload,
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