import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import mime from 'mime'
import type { NextRequest } from 'next/server'
import { resolveSafe } from '@/lib/server/path'
import { HttpError, handle, nodeToWeb } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const filePath = req.nextUrl.searchParams.get('filePath') ?? ''

    if (!filePath) {
      throw new HttpError(400, '参数不完整')
    }

    const target = resolveSafe(filePath)

    if (!existsSync(target) || !statSync(target).isFile()) {
      throw new HttpError(404, '文件不存在')
    }

    const type = mime.getType(extname(target)) || 'application/octet-stream'

    // 仅文本类追加字符集，二进制文件保持原始 Content-Type
    return new Response(nodeToWeb(createReadStream(target)), {
      headers: {
        'Content-Type': type.startsWith('text/') ? `${type}; charset=utf-8` : type,
        'Content-Length': String(statSync(target).size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(basename(target))}`
      }
    })
  })
}
