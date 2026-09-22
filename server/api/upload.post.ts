import Busboy from 'busboy'
import { createWriteStream, mkdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { UploadResult } from '#shared/types'
import { appConfig, ensureRoot } from '../utils/config'
import { decodeFileName, resolveSafe, safeUploadFileName, uniqueName } from '../utils/path'

/** 上传失败时 Promise 里传递的错误，status 决定对外的 HTTP 状态码 */
interface UploadFailure extends Error {
  status: number
}

export default defineEventHandler(async (event): Promise<UploadResult> => {
  const { filePath: rawPath } = getQuery(event)
  const filePath = typeof rawPath === 'string' ? rawPath : ''

  const { maxFileSize = 0, maxFiles = 0, maxRequestSize = 0 } = appConfig()

  // maxRequestSize：Content-Length 预检（无 Content-Length 的 chunked 编码由 busboy 的 fileSize 限制兜底）
  if (maxRequestSize > 0) {
    const contentLength = Number(event.node.req.headers['content-length'] || 0)
    if (contentLength > maxRequestSize) {
      throw createError({ statusCode: 413, message: `请求体超过上限 ${maxRequestSize} 字节` })
    }
  }

  ensureRoot()

  const dir = resolveSafe(filePath)
  // 注意：不在这里 mkdir，等第一个文件 part 到达时再创建。
  // 否则客户端声明了 filePath 但一个文件都没传（或全被 maxFiles 拦截），
  // 会在目标位置留下空目录。
  let dirCreated = false

  const created: string[] = [] // 本请求实际创建的文件，失败时统一清理
  const saved: string[] = [] // 实际落盘的文件名（可能与原始名不同，重名会追加序号）
  const usedNames = new Set<string>() // 批次内互斥，防止同名文件互相覆盖
  let fileCount = 0 // 已接收的 file part 数，用于与 maxFiles 比较

  /**
   * 统一的结束入口：
   * - 任何错误都会先断开写流、等所有写流结束，再对外返回，
   *   保证清理时文件句柄已释放（Windows 上删除被占用文件会报 EBUSY）。
   * - 语义为 all-or-nothing：任一文件失败，本次请求已写入的文件全部回滚。
   */
  const result = await new Promise<UploadFailure | null>((resolve) => {
    const busboy = Busboy({
      headers: event.node.req.headers,
      // 显式指定 utf8，保证中文文件名不被按 latin1 解码
      defParamCharset: 'utf8',
      // 资源上限：fileSize 单文件、files part 数；0 = 不限制。
      // 超限时 busboy 会 emit 'limit' 事件并将 stream 切到错误态。
      limits: {
        ...(maxFileSize > 0 ? { fileSize: maxFileSize } : {}),
        ...(maxFiles > 0 ? { files: maxFiles } : {})
      }
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

    const onWriteError = (error: Error) => fail(`写入失败：${error.message}`, 500)

    busboy.on('file', (_field, stream, info) => {
      fileCount += 1

      // busboy 在触发 'file' 时已经接收了 multipart 头，文件名等元数据可信；
      // limits.files 是「超过后丢弃」，因此这里再加一道显式拦截以得到清晰错误。
      if (maxFiles > 0 && fileCount > maxFiles) {
        stream.resume() // 必须消费流，否则 busboy 会 hang
        return
      }

      const name = uniqueName(dir, safeUploadFileName(decodeFileName(info.filename)), usedNames)
      const target = join(dir, name)

      // 首个文件到达时才真正创建目标目录
      if (!dirCreated) {
        mkdirSync(dir, { recursive: true })
        dirCreated = true
      }

      created.push(target)
      saved.push(name)

      // 标记：该文件因超过 maxFileSize 被 busboy 截断，不能算成功落盘
      let truncated = false

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
            // 被截断的文件：从 created/saved 中剔除，后续统一清理/不返回给前端
            if (truncated) {
              const ci = created.indexOf(target)
              if (ci !== -1) created.splice(ci, 1)
              const si = saved.indexOf(name)
              if (si !== -1) saved.splice(si, 1)
            }
            done()
          })

          stream.on('error', failed)

          // busboy 在 fileSize 超限时在「文件流」上 emit 'limit'，
          // 并把后续数据截断、正常 end。必须在这里标记，不能挂在 busboy 实例上。
          stream.on('limit', () => {
            truncated = true
            console.warn(`[disk] 文件超过 maxFileSize=${maxFileSize}，已截断并剔除：${name}`)
          })

          stream.pipe(output)
        })
      )
    })

    // 请求体格式错误
    busboy.on('error', (error: Error) => fail(`请求体解析失败：${error.message}`, 400))

    // 客户端中途断开：req 没有正常读完就 close，半成品必须回滚
    const req = event.node.req
    let aborted = false
    const onAbort = () => {
      aborted = true
      fail('客户端中断了上传', 400)
    }
    req.on('aborted', onAbort)
    req.on('error', onAbort)
    req.on('close', () => {
      if (!req.readableEnded) {
        onAbort()
      }
    })

    // close 在所有 part 解析完成后触发，此时再等所有写流结束。
    // 注意：客户端 abort 时 busboy 也会 emit close，必须用 aborted 标志跳过，
    // 否则 finish(null) 会把"被中断"覆盖成"成功"，导致不进入回滚分支。
    busboy.on('close', () => {
      if (aborted) return
      finish(null)
    })

    event.node.req.pipe(busboy)
  })

  if (result) {
    if (created.length) {
      await Promise.allSettled(created.map((target) => rm(target, { force: true })))
    }

    throw createError({
      statusCode: result.status || 500,
      message: `文件上传失败：${result.message}`
    })
  }

  if (!saved.length) {
    throw createError({ statusCode: 400, message: '没有接收到文件（或全部被大小/数量限制拦截）' })
  }

  return { code: 200, message: '文件上传成功', data: saved }
})
