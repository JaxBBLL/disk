import type { ApiResponse } from '#shared/types'
import { mkdirSync } from 'node:fs'
import type { UploadSession } from '../../utils/upload-tmp'
import {
  cleanupUpload,
  createSession,
  getTmpDir,
  getUploadedChunks
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
 *
 * 断点续传语义（当前实现）：
 * - 每次 init 都会生成全新的 uploadId 与临时目录，不复用历史会话。
 * - uploadedChunks / uploadedBytes 是给前端做进度展示的字段；
 *   在当前「每次都新建会话」的实现下，它们恒为空 / 0。
 * - 客户端中断（abort）后，已上传分片仍留在临时目录中，
 *   但因会话 map 已丢失对应 uploadId，无法通过再次 init 自动续传，
 *   需要重新走完整流程。重启服务 / 临时目录被 rm 后同样无法续传。
 *
 * 若未来要支持真正的断点续传，需要在此按 fileName+fileSize+totalChunks
 * 匹配存活会话并复用 uploadId，同时保留磁盘上的分片目录。
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

  // 客户端 init 后立即 abort（拿不到 uploadId 调 cancel 接口）：
  // 在服务端兜底清理掉这个孤儿会话与临时目录。
  // 多用户并发安全：uploadId 全机器唯一，不会误伤其他用户。
  const req = event.node.req
  req.on('aborted', () => {
    console.log(`[disk] init aborted for ${session.uploadId}, cleaning tmp`)
    cleanupUpload(session.uploadId)
  })

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