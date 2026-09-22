/**
 * 分片上传客户端工具。
 *
 * 阈值：>= 5 MB 的文件走分片流程，更小的走单次 FormData 上传。
 * 分片大小固定 5 MB（可调整 CHUNK_SIZE）。
 *
 * 流程：
 *   1. POST /api/upload/init           → 拿到 uploadId + uploadedChunks
 *   2. 跳过 uploadedChunks；其余分片串行 POST /api/upload/chunk
 *   3. POST /api/upload/merge          → 落盘 + 清理临时目录
 *
 * 进度回调：onProgress(loaded, total) 每次分片 chunk 事件触发，
 * 上层 useFileAction 把它合并进全批次的 loadedBytes。
 *
 * 中断：传入 AbortController.signal，三个请求任一被 abort → 抛出 AbortError，
 * 已上传的分片留在临时目录；当前实现下重新 init 会拿到全新的 uploadId，
 * 暂不自动续传已上传分片（需重传）。若未来支持断点续传，可利用 init 返回的
 * uploadedChunks 列表跳过分片。
 */

export const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB

/** 大于等于该阈值走分片流程 */
export function shouldChunk(size: number): boolean {
  return size >= CHUNK_SIZE
}

interface InitBody {
  fileName: string
  totalChunks: number
  chunkSize: number
  fileSize: number
}

interface InitData {
  uploadId: string
  chunkSize: number
  totalChunks: number
  uploadedChunks: number[]
  uploadedBytes: number
}

interface InitResponse {
  code: number
  message: string
  data: InitData
}

interface MergeBody {
  uploadId: string
  filePath: string[]
  fileName: string
  totalChunks: number
}

interface MergeResponse {
  code: number
  message: string
  data: string[]
}

export interface ChunkedUploadOptions {
  file: File
  /** 目标目录的路径片段数组（与单次上传一致） */
  filePath: string[]
  signal?: AbortSignal
  /** 单文件粒度的字节进度回调 */
  onProgress?: (loaded: number, total: number) => void
  /**
   * init 拿到 uploadId 后立即回调，让调用方登记到 cancel 追踪集合。
   * 注意：init 抛错（abort）时此回调不会被调用，因为根本没拿到 id。
   */
  onUploadId?: (uploadId: string) => void
}

export interface ChunkedUploadResult {
  /** 实际落盘的文件名（可能被 uniqueName 加序号）；undefined = 未成功落地 */
  savedName?: string
  /**
   * 此次上传的会话 ID。前端 cancel 时用此 ID 调 /api/upload/cancel
   * 让服务端清理临时目录；多用户并发下每个 upload 独立。
   * 即使上传失败也会返回（init 已经成功），便于调用方清理孤儿临时目录。
   */
  uploadId: string
}

/**
 * 分片上传单个文件；调用方负责保证 file.size 足够大（用 shouldChunk 判断）。
 *
 * 抛错场景：
 * - AbortError：用户取消；调用方不应再调 cancel POST（服务端 init 的 req.on('aborted）
 *   已经清临时目录）。
 * - 其他错误：merge 失败 / 服务端 500；调用方应拿到 uploadId 并调 cancel POST
 *   让服务端清掉 init/chunk 留下的孤儿。
 *
 * 成功返回 { savedName, uploadId }，savedName 是服务端最终落盘的文件名。
 */
export async function uploadInChunks(
  opts: ChunkedUploadOptions
): Promise<ChunkedUploadResult> {
  const { file, filePath, signal, onProgress, onUploadId } = opts

  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
  let loadedBytes = 0

  // 1) init
  let uploadId: string
  let skipChunks: number[]
  try {
    const initRes = await $fetch<InitResponse>('/api/upload/init', {
      method: 'POST',
      body: {
        fileName: file.name,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        fileSize: file.size
      } satisfies InitBody,
      signal
    })
    uploadId = initRes.data.uploadId
    skipChunks = initRes.data.uploadedChunks
    // 拿到 id 立刻通知调用方，便于 cancel 时清理
    onUploadId?.(uploadId)
  } catch (error) {
    // init 阶段 abort / 失败：服务端 req.on('aborted) 已兜底清理，这里直接抛
    throw error
  }

  onProgress?.(0, file.size)

  // 2) 分片上传（串行；跳过已上传的）
  const skip = new Set<number>(skipChunks)

  for (let i = 0; i < totalChunks; i++) {
    if (skip.has(i)) {
      // 已上传的片按完整一片字节计入进度
      loadedBytes += CHUNK_SIZE
      onProgress?.(Math.min(loadedBytes, file.size), file.size)
      continue
    }

    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const slice = file.slice(start, end)

    const form = new FormData()
    form.append('uploadId', uploadId)
    form.append('index', String(i))
    form.append('chunk', slice, `${file.name}.part${i}`)

    await $fetch('/api/upload/chunk', {
      method: 'POST',
      body: form,
      signal,
      onUploadProgress: (event: { loaded: number; total?: number }) => {
        // 本分片累计已发字节（首字节 = 已跳过字节 + 本片新字节）
        const totalLoaded = loadedBytes + event.loaded
        onProgress?.(Math.min(totalLoaded, file.size), file.size)
      }
    })

    loadedBytes += end - start
    onProgress?.(Math.min(loadedBytes, file.size), file.size)
  }

  // 3) merge
  try {
    const mergeRes = await $fetch<MergeResponse>('/api/upload/merge', {
      method: 'POST',
      body: {
        uploadId,
        filePath,
        fileName: file.name,
        totalChunks
      } satisfies MergeBody,
      signal
    })

    const savedName = mergeRes.data[0]
    if (!savedName) {
      throw Object.assign(new Error('merge: 服务端未返回落盘文件名'), { uploadId })
    }
    return { savedName, uploadId }
  } catch (error) {
    // merge 抛错时把 uploadId 挂到 error 上，让调用方有机会清理临时目录
    if (error instanceof Error && !(error as { uploadId?: string }).uploadId) {
      Object.assign(error, { uploadId })
    }
    throw error
  }
}