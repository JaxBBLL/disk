import type { ApiResponse } from '#shared/types'
import { cleanupUpload } from '../../utils/upload-tmp'

interface CancelBody {
  uploadId?: string
}

/**
 * 前端主动调用：让服务端删除指定 uploadId 的临时目录与会话记录。
 *
 * 触发场景：
 * - 用户在上传大文件时点击「取消」按钮，前端 abort 信号让 init/chunk/merge
 *   立刻 reject；abort 信号不会自动到达服务端清理临时目录，所以前端
 *   在 abort 之后再 fire-and-forget 调用本接口清理。
 *
 * 多用户并发安全：uploadId 由服务端按时间戳+随机+序号生成，全机器唯一；
 * 不同用户/不同 tab 的上传彼此 uploadId 不可能相同。删除 `{uploadId}/`
 * 不会误伤其他用户。
 *
 * 幂等：cleanupUpload 内 rmSync(force) + sessions.delete 都允许目标不存在。
 * 即使会话已 merge 完成 / uploadId 不存在 / 临时目录已清，也返回 200。
 */
export default defineEventHandler(async (event): Promise<ApiResponse> => {
  const body = await readBody<CancelBody | null>(event)

  if (!body?.uploadId || typeof body.uploadId !== 'string') {
    throw createError({ statusCode: 400, message: '缺少 uploadId' })
  }

  cleanupUpload(body.uploadId)

  return { code: 200, message: 'ok' }
})