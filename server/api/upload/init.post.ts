import type { ApiResponse } from '#shared/types'
import { mkdirSync } from 'node:fs'
import type { UploadSession } from '../../utils/upload-tmp'
import {
  createSession,
  getTmpDir,
  getUploadedChunks,
  getUploadSession
} from '../../utils/upload-tmp'

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
  /** 已上传字节数（用于断点续传时给前端做参考） */
  uploadedBytes: number
}

/**
 * 分片上传 init：创建一个 upload session，返回 uploadId + 已上传分片。
 * 断点续传：若传同样的 fileName + fileSize，且磁盘上仍有遗留分片，
 * 会复用同一个 uploadId 并返回已上传分片索引列表，让前端跳过这些分片。
 *
 * 简化版断点续传：仅按「同进程内 / 临时目录未清理」判定，不做 hash 校验。
 * 重启服务 / 临时目录被 rm 后无法续传，需要重新 init。
 */
export default defineEventHandler(async (event): Promise<ApiResponse<InitData>> => {
  const body = await readBody<InitBody | null>(event)

  if (
    !body ||
    !body.fileName ||
    !Number.isInteger(body.totalChunks) ||
    body.totalChunks <= 0 ||
    !Number.isInteger(body.chunkSize) ||
    body.chunkSize <= 0
  ) {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  const session = createSession({
    fileName: body.fileName,
    totalChunks: body.totalChunks,
    chunkSize: body.chunkSize,
    fileSize: body.fileSize ?? 0
  })

  // 立刻创建临时目录：避免第一次 chunk 上传时与目录创建产生竞态
  mkdirSync(getTmpDir(session.uploadId), { recursive: true })

  const uploadedChunks = getUploadedChunks(session.uploadId)
  const uploadedBytes = uploadedChunks.reduce(
    (sum, idx) => sum + computeChunkSize(session, idx),
    0
  )

  return {
    code: 200,
    message: 'ok',
    data: {
      uploadId: session.uploadId,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      uploadedChunks,
      uploadedBytes
    }
  }
})

/** 复用模块内的 helper：第 idx 片的字节数（最后一片可能更小） */
function computeChunkSize(session: UploadSession, idx: number): number {
  if (idx < session.totalChunks - 1) {
    return session.chunkSize
  }
  // 最后一片：fileSize - (totalChunks-1)*chunkSize
  return Math.max(0, session.fileSize - (session.totalChunks - 1) * session.chunkSize)
}

/** 给 smoke 测试用：列出已知 uploadId 的会话是否存在 */
export function _peekSession(uploadId: string): UploadSession | undefined {
  return getUploadSession(uploadId)
}