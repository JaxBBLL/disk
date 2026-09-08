import Busboy from 'busboy'
import { createWriteStream, mkdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { NextRequest } from 'next/server'
import type { UploadResult } from '@/lib/types'
import { ensureRoot } from '@/lib/server/config'
import { decodeFileName, resolveSafe, uniqueName } from '@/lib/server/path'
import { HttpError, handle, json } from '@/lib/server/http'

export const runtime = 'nodejs'

/** 上传失败时 Promise 里传递的错误，status 决定对外的 HTTP 状态码 */
interface UploadFailure extends Error {
  status: number
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const filePath = req.nextUrl.searchParams.get('filePath') ?? ''

    ensureRoot()

    const dir = resolveSafe(filePath)
    mkdirSync(dir, { recursive: true })

    if (!req.body) {
      throw new HttpError(400, '没有接收到文件')
    }

    const created: string[] = [] // 本请求实际创建的文件，失败时统一清理
    const saved: string[] = [] // 实际落盘的文件名（可能与原始名不同，重名会追加序号）
    const usedNames = new Set<string>() // 批次内互斥，防止同名文件互相覆盖

    // Web 请求体 → Node 可读流，交给 busboy 流式解析，避免整体读进内存
    const source = Readable.fromWeb(req.body as unknown as NodeReadableStream)

    // busboy 需要普通对象形式的请求头
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    /**
     * 统一的结束入口：
     * - 任何错误都会先断开写流、等所有写流结束，再对外返回，
     *   保证清理时文件句柄已释放（Windows 上删除被占用文件会报 EBUSY）。
     * - 语义为 all-or-nothing：任一文件失败，本次请求已写入的文件全部回滚。
     */
    const result = await new Promise<UploadFailure | null>((resolve) => {
      const busboy = Busboy({
        headers,
        // 显式指定 utf8，保证中文文件名不被按 latin1 解码
        defParamCharset: 'utf8'
      })

      const writing: Promise<void>[] = []
      const outputs = new Set<NodeJS.WritableStream & { destroy: () => void }>()
      let settled = false

      const finish = (error: UploadFailure | null) => {
        if (settled) {
          return
        }
        settled = true

        Promise.allSettled(writing).then(() => resolve(error))
      }

      const fail = (message: string, status: number) => {
        if (settled) {
          return
        }
        for (const output of outputs) {
          output.destroy()
        }
        finish(Object.assign(new Error(message), { status }))
      }

      busboy.on('file', (_field, stream, info) => {
        const name = uniqueName(dir, decodeFileName(info.filename), usedNames)
        const target = join(dir, name)

        created.push(target)
        saved.push(name)

        writing.push(
          new Promise<void>((done, failed) => {
            const output = createWriteStream(target)

            outputs.add(output)

            // 主动 destroy 时只会触发 close（不触发 finish/error），
            // 必须监听 close 才能让 Promise 落定，否则 allSettled 永久挂起
            output.on('finish', () => {
              outputs.delete(output)
              done()
            })
            output.on('error', (error) => {
              outputs.delete(output)
              failed(error)
            })
            output.on('close', () => {
              outputs.delete(output)
              done()
            })

            stream.on('error', failed)

            stream.pipe(output)
          })
        )
      })

      // 请求体格式错误
      busboy.on('error', (error: Error) => fail(`请求体解析失败：${error.message}`, 400))

      // 客户端中途断开：body 没有正常读完就 close，半成品必须回滚
      const onAbort = () => fail('客户端中断了上传', 400)
      source.on('aborted', onAbort)
      source.on('error', onAbort)
      source.on('close', () => {
        if (!source.readableEnded) {
          onAbort()
        }
      })
      req.signal.addEventListener('abort', onAbort)

      // close 在所有 part 解析完成后触发，此时再等所有写流结束
      busboy.on('close', () => finish(null))

      source.pipe(busboy)
    })

    if (result) {
      if (created.length) {
        await Promise.allSettled(created.map((target) => rm(target, { force: true })))
      }

      throw new HttpError(result.status || 500, `文件上传失败：${result.message}`)
    }

    if (!saved.length) {
      throw new HttpError(400, '没有接收到文件')
    }

    return json({ code: 200, message: '文件上传成功', data: saved } satisfies UploadResult)
  })
}
