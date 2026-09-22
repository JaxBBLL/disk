import Busboy from 'busboy'
import { appConfig } from '../../utils/config'
import { writeChunk } from '../../utils/upload-tmp'

/**
 * 接收一个分片：
 *   multipart/form-data
 *     - uploadId: text
 *     - index:    text（数字字符串）
 *     - chunk:    file
 *
 * 分片写入 {dest}/.upload-tmp/{uploadId}/{index}.part。
 *
 * 失败 / 客户端中断：
 * - 客户端 abort 时 req.on('aborted') 拒绝 promise → Nitro 返回 400。
 * - 中途断连会留下部分分片在临时目录里；前端重新 init 会被 init 返回的
 *   uploadedChunks 列表告知，可以跳过已上传的分片（断点续传）。
 *
 * 上限：appConfig.maxFileSize 也作为单分片上限使用（避免恶意把 50GB
 * 当成「1 个分片」直接灌进服务进程内存）。
 */
export default defineEventHandler(async (event) => {
  const { maxFileSize = 0, maxRequestSize = 0 } = appConfig()

  // maxRequestSize：Content-Length 预检（分片本身已有 maxFileSize 兜底）
  if (maxRequestSize > 0) {
    const contentLength = Number(event.node.req.headers['content-length'] || 0)
    if (contentLength > maxRequestSize) {
      throw createError({ statusCode: 413, message: `请求体超过上限 ${maxRequestSize} 字节` })
    }
  }

  const result = await new Promise<{ uploadId: string; index: number }>((resolve, reject) => {
    let uploadId = ''
    let index = -1
    let settled = false

    const finish = (error: Error | null, value?: { uploadId: string; index: number }) => {
      if (settled) return
      settled = true
      if (error) {
        reject(error)
      } else if (value) {
        resolve(value)
      } else {
        reject(new Error('缺少 uploadId 或 index'))
      }
    }

    const busboy = Busboy({
      headers: event.node.req.headers,
      defParamCharset: 'utf8',
      limits: maxFileSize > 0 ? { fileSize: maxFileSize } : {}
    })

    busboy.on('field', (name, value) => {
      if (name === 'uploadId') {
        uploadId = String(value)
      } else if (name === 'index') {
        const n = parseInt(String(value), 10)
        if (Number.isFinite(n)) index = n
      }
    })

    busboy.on('file', (_field, stream) => {
      if (!uploadId || index < 0) {
        stream.resume()
        finish(new Error('缺少 uploadId 或 index'))
        return
      }

      let truncated = false
      // fileSize 超限时 busboy 在文件流上 emit 'limit'，并截断后续数据
      stream.on('limit', () => {
        truncated = true
      })

      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      stream.on('end', () => {
        if (settled) return
        if (truncated) {
          finish(new Error(`分片超过 maxFileSize=${maxFileSize} 上限，已拒绝`))
          return
        }
        try {
          const data = Buffer.concat(chunks)
          writeChunk(uploadId, index, data)
          finish(null, { uploadId, index })
        } catch (error) {
          finish(error as Error)
        }
      })
      stream.on('error', (error: Error) => {
        finish(error)
      })
    })

    busboy.on('error', (error: Error) => finish(error))

    // 客户端中断：拒绝 promise，让 Nitro 返回错误；留下的部分分片
    // 由前端的断点续传 / 临时目录清理机制处理
    const req = event.node.req
    req.on('aborted', () => {
      finish(new Error('客户端中断了分片上传'))
    })

    event.node.req.pipe(busboy)
  })

  return { code: 200, message: 'ok', data: result }
})