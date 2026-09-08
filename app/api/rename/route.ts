import { existsSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { NextRequest } from 'next/server'
import type { ApiResponse, RenameBody } from '@/lib/types'
import { assertValidName, resolveSafe, toRelPath } from '@/lib/server/path'
import { HttpError, handle, json, readJson } from '@/lib/server/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await readJson<RenameBody | null>(req)
    const filePath = String(body?.filePath ?? '')

    if (!filePath) {
      throw new HttpError(400, '参数不完整')
    }

    const newName = assertValidName(body?.newName)

    const oldTarget = resolveSafe(filePath)

    // 用「父目录 + 新名」拼接，替代原实现的 filePath.split(oldName)[0]，
    // 避免文件名在父级目录中重复出现时被截断。
    const parent = dirname(oldTarget)
    const newTarget = resolveSafe(join(toRelPath(parent), newName))

    if (existsSync(newTarget)) {
      return json({
        code: 200,
        isExit: 1,
        message: '目录存在相同文件名'
      } satisfies ApiResponse<boolean>)
    }

    try {
      await rename(oldTarget, newTarget)
    } catch (error) {
      throw new HttpError(500, `修改失败：${(error as Error).message}`)
    }

    return json({ code: 200, data: true, message: '修改成功' } satisfies ApiResponse<boolean>)
  })
}
