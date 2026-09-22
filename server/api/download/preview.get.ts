import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import mime from 'mime'
import { resolveSafe } from '../../utils/path'

export default defineEventHandler(async (event) => {
  const { filePath: rawPath } = getQuery(event)
  const filePath = typeof rawPath === 'string' ? rawPath : ''

  if (!filePath) {
    throw createError({ statusCode: 400, message: '参数不完整' })
  }

  const target = resolveSafe(filePath)

  if (!existsSync(target) || !statSync(target).isFile()) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  const type = mime.getType(extname(target)) || 'application/octet-stream'

  // 防 MIME 嗅探 XSS：禁止浏览器绕过 Content-Type 猜测类型
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  // HTML / SVG / XML 等可在同源执行脚本的类型，加 CSP sandbox 隔离，
  // 防止上传的恶意静态页在预览时读取同源 Cookie / 调用 API。
  const scriptable = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|application\/xml|text\/xml)$/
  if (scriptable.test(type)) {
    setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
  }

  // 仅文本类追加字符集，二进制文件保持原始 Content-Type
  setHeader(event, 'Content-Type', type.startsWith('text/') ? `${type}; charset=utf-8` : type)
  setHeader(event, 'Content-Length', statSync(target).size)
  setHeader(
    event,
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(basename(target))}`
  )

  return sendStream(event, createReadStream(target))
})
