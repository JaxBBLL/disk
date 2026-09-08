import { ZipArchive } from 'archiver'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import type { NextRequest } from 'next/server'
import { resolveSafe } from '@/lib/server/path'
import { HttpError, handle, nodeToWeb } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RFC 5987，保证中文下载名不乱码
function disposition(name: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const { searchParams } = req.nextUrl

    let paths: string[] = []

    try {
      paths = JSON.parse(String(searchParams.get('filePaths') || '[]')) as string[]
    } catch {
      throw new HttpError(400, '参数错误')
    }

    if (!paths.length) {
      throw new HttpError(400, '请选择文件')
    }

    const targets = paths.map((item) => resolveSafe(item)).filter(existsSync)

    if (!targets.length) {
      throw new HttpError(404, '文件不存在')
    }

    // 单文件直接推流，不做压缩
    const [first] = targets

    if (targets.length === 1 && first && statSync(first).isFile()) {
      const file = first

      return new Response(nodeToWeb(createReadStream(file)), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(statSync(file).size),
          'Content-Disposition': disposition(basename(file))
        }
      })
    }

    // 多文件 / 目录：边打包边推流，不落临时文件
    const archive = new ZipArchive({ zlib: { level: 9 } })

    for (const target of targets) {
      if (statSync(target).isFile()) {
        archive.file(target, { name: basename(target) })
      } else {
        archive.directory(target, basename(target))
      }
    }

    // 先把流挂到响应上再 finalize，避免开始消费前的短暂窗口丢数据
    const response = new Response(nodeToWeb(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': disposition(`disk-${Date.now()}.zip`)
      }
    })

    archive.finalize().catch((error: Error) => {
      console.error(`[disk] 打包失败：${error.message}`)
    })

    return response
  })
}
