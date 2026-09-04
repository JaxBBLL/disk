import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ApiResponse, RenameBody } from '#shared/types'
import { assertValidName, resolveSafe, toRelPath } from '../utils/path'

export default defineEventHandler(async (event): Promise<ApiResponse<boolean>> => {
  const body = await readBody<RenameBody | null>(event)
  const filePath = String(body?.filePath ?? '')

  if (!filePath) {
    throw createError({ statusCode: 400, message: '参数不完整' })
  }

  const newName = assertValidName(body?.newName)

  const oldTarget = resolveSafe(filePath)

  // 用「父目录 + 新名」拼接，替代原实现的 filePath.split(oldName)[0]，
  // 避免文件名在父级目录中重复出现时被截断。
  const parent = dirname(oldTarget)
  const newTarget = resolveSafe(join(toRelPath(parent), newName))

  if (existsSync(newTarget)) {
    return { code: 200, isExit: 1, message: '目录存在相同文件名' }
  }

  try {
    await rename(oldTarget, newTarget)
  } catch (error) {
    throw createError({ statusCode: 500, message: `修改失败：${(error as Error).message}` })
  }

  return { code: 200, data: true, message: '修改成功' }
})
