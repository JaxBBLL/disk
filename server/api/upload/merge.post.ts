import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ApiResponse, UploadResult } from '#shared/types'
import {
  cleanupUpload,
  getUploadSession,
  mergeChunks
} from '../../utils/upload-tmp'
import { resolveSafe, uniqueName } from '../../utils/path'

interface MergeBody {
  uploadId: string
  filePath: string | string[]
  fileName: string
  totalChunks: number
}

/**
 * 把上传会话的所有分片合并到目标路径，校验齐全，清理临时目录。
 * 目标文件名会经 uniqueName 处理以避免覆盖现有文件。
 */
export default defineEventHandler(async (event): Promise<ApiResponse<UploadResult['data']>> => {
  const body = await readBody<MergeBody | null>(event)

  if (
    !body ||
    !body.uploadId ||
    !body.fileName ||
    !Number.isInteger(body.totalChunks) ||
    body.totalChunks <= 0
  ) {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  const session = getUploadSession(body.uploadId)
  if (!session) {
    throw createError({ statusCode: 404, message: 'uploadId 无效或已过期' })
  }

  // totalChunks 以服务端 session 为准，客户端传入值仅作兼容性校验。
  // 否则恶意客户端可谎报更小的 totalChunks，把未上传的分片跳过、静默产出截断文件。
  if (body.totalChunks !== session.totalChunks) {
    throw createError({
      statusCode: 400,
      message: `totalChunks 不匹配（服务端 ${session.totalChunks}，客户端 ${body.totalChunks}）`
    })
  }

  const dir = resolveSafe(body.filePath ?? [])
  mkdirSync(dir, { recursive: true })

  // 落盘名走 uniqueName 防覆盖；前端已经做了「同名自动 -1 / -2」的语义，
  // 但用户可能在合并前已改名 / 删除，所以服务端再 uniqueName 一次保险。
  const safeName = basename(String(body.fileName))
  const target = join(dir, uniqueName(dir, safeName))

  try {
    mergeChunks(body.uploadId, session.totalChunks, target)
  } catch (error) {
    // 合并失败：清理临时目录与 session
    cleanupUpload(body.uploadId)
    throw createError({
      statusCode: (error as { statusCode?: number }).statusCode ?? 500,
      message: `分片合并失败：${(error as Error).message}`
    })
  }

  return {
    code: 200,
    message: '文件上传成功',
    data: [basename(target)]
  }
})