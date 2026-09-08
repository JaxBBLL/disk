import type { NextRequest } from 'next/server'
import type { ApiResponse, CreateBody } from '@/lib/types'
import { ensureRoot } from '@/lib/server/config'
import { createFolder } from '@/lib/server/fs'
import { assertValidName, resolveSafe } from '@/lib/server/path'
import { HttpError, handle, json, readJson } from '@/lib/server/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await readJson<CreateBody | null>(req)
    const name = assertValidName(body?.name)

    ensureRoot()

    const dir = resolveSafe(body?.filePath ?? [])

    const result = createFolder(dir, name)

    if (result === 2) {
      return json({ code: 200, isExit: 1, message: '目录已存在' } satisfies ApiResponse)
    }

    if (result === 1) {
      return json({ code: 200, isExit: 0, message: '操作成功' } satisfies ApiResponse)
    }

    throw new HttpError(500, '创建失败')
  })
}
