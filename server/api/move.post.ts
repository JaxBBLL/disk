import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { ApiResponse, MoveBody, MoveResult } from '#shared/types'
import { resolveSafe } from '../utils/path'

export default defineEventHandler(async (event): Promise<ApiResponse<MoveResult[]>> => {
  const body = await readBody<MoveBody | null>(event)
  const filePaths = body?.filePaths ?? []
  const newFolder = body?.newFolder ?? ''

  if (!filePaths.length) {
    throw createError({ statusCode: 400, message: '请选择文件' })
  }

  const destDir = resolveSafe(newFolder)
  const responses: MoveResult[] = []

  for (const filePath of filePaths) {
    const oldTarget = resolveSafe(filePath)
    const newTarget = join(destDir, basename(oldTarget))

    if (existsSync(newTarget)) {
      responses.push({ code: 200, isExit: 1, message: '目录存在相同文件名' })
      continue
    }

    try {
      await rename(oldTarget, newTarget)
      responses.push({ code: 200, data: true, message: '修改成功' })
    } catch (error) {
      responses.push({ code: 500, message: `修改失败：${(error as Error).message}` })
    }
  }

  return { code: 200, data: responses }
})
