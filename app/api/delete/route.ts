import type { NextRequest } from 'next/server'
import type { ApiResponse, DeleteBody } from '@/lib/types'
import { appConfig } from '@/lib/server/config'
import { deleteFileOrFolder } from '@/lib/server/fs'
import { resolveSafe } from '@/lib/server/path'
import { HttpError, handle, json, readJson } from '@/lib/server/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const { hasDel } = appConfig()

    if (!hasDel) {
      throw new HttpError(403, '没有删除权限')
    }

    const body = await readJson<DeleteBody | null>(req)
    const filePaths = body?.filePaths ?? []

    if (!filePaths.length) {
      throw new HttpError(400, '请选择文件')
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
      throw new HttpError(500, '部分文件删除失败', { failedDeletions })
    }

    return json({ code: 200, message: '删除成功' } satisfies ApiResponse)
  })
}
