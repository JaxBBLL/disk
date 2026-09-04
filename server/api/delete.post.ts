import type { ApiResponse, DeleteBody } from '#shared/types'
import { appConfig } from '../utils/config'
import { deleteFileOrFolder } from '../utils/fs'
import { resolveSafe } from '../utils/path'

export default defineEventHandler(async (event): Promise<ApiResponse> => {
  const { hasDel } = appConfig()

  if (!hasDel) {
    throw createError({ statusCode: 403, message: '没有删除权限' })
  }

  const body = await readBody<DeleteBody | null>(event)
  const filePaths = body?.filePaths ?? []

  if (!filePaths.length) {
    throw createError({ statusCode: 400, message: '请选择文件' })
  }

  const failedDeletions: string[] = []

  for (const filePath of filePaths) {
    try {
      await deleteFileOrFolder(resolveSafe(filePath))
    } catch (error) {
      // 目标已不存在视为删除成功，保证接口幂等
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        continue
      }
      console.error(`[disk] 删除失败：${String(filePath)} ${(error as Error).message}`)
      failedDeletions.push(String(filePath))
    }
  }

  if (failedDeletions.length) {
    throw createError({
      statusCode: 500,
      message: '部分文件删除失败',
      data: { failedDeletions }
    })
  }

  return { code: 200, message: '删除成功' }
})
