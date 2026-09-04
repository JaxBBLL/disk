import type { ApiResponse, CreateBody } from '#shared/types'
import { ensureRoot } from '../utils/config'
import { createFolder } from '../utils/fs'
import { assertValidName, resolveSafe } from '../utils/path'

export default defineEventHandler(async (event): Promise<ApiResponse> => {
  const body = await readBody<CreateBody | null>(event)
  const name = assertValidName(body?.name)

  ensureRoot()

  const dir = resolveSafe(body?.filePath ?? [])

  const result = createFolder(dir, name)

  if (result === 2) {
    return { code: 200, isExit: 1, message: '目录已存在' }
  }

  if (result === 1) {
    return { code: 200, isExit: 0, message: '操作成功' }
  }

  throw createError({ statusCode: 500, message: '创建失败' })
})
