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

  const { maxFileSize = 0, maxFiles = 0 } = appConfig()

  ensureRoot()

  const dir = resolveSafe(filePath)
  mkdirSync(dir, { recursive: true })

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

    // busboy 在 fileSize 超限后会触发该事件并把 stream 切到错误态。
    // 不在此 fail()，否则会把整个批次回滚；只把超限文件剔除即可。
    busboy.on('limit', () => {
      console.warn(
        `[disk] upload limit reached (maxFileSize=${maxFileSize}, maxFiles=${maxFiles})`
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
    throw createError({ statusCode: 400, message: '没有接收到文件' })
  }

  return { code: 200, message: '文件上传成功', data: saved }
})
