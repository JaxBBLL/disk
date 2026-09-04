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
