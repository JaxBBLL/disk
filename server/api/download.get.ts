import { ZipArchive } from 'archiver'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { resolveSafe } from '../utils/path'

// RFC 5987，保证中文下载名不乱码
function disposition(name: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
}

export default defineEventHandler(async (event) => {
  const { filePaths } = getQuery(event)

  let paths: string[] = []

  try {
    paths = JSON.parse(String(filePaths || '[]')) as string[]
  } catch {
    throw createError({ statusCode: 400, message: '参数错误' })
  }

  if (!paths.length) {
    throw createError({ statusCode: 400, message: '请选择文件' })
  }

  const targets = paths.map((item) => resolveSafe(item)).filter(existsSync)

  if (!targets.length) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  // 单文件直接推流，不做压缩
  const [first] = targets

  if (targets.length === 1 && first && statSync(first).isFile()) {
    const file = first
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(event, 'Content-Length', statSync(file).size)
    setHeader(event, 'Content-Disposition', disposition(basename(file)))
    return sendStream(event, createReadStream(file))
  }

  // 多文件 / 目录：边打包边推流，不落临时文件
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', disposition(`disk-${Date.now()}.zip`))

  // archiver v8 起为纯 ESM 具名导出，使用 ZipArchive 类而非工厂函数
  const archive = new ZipArchive({ zlib: { level: 9 } })

  for (const target of targets) {
    if (statSync(target).isFile()) {
      archive.file(target, { name: basename(target) })
    } else {
      archive.directory(target, basename(target))
    }
  }

  // sendStream 内部同步挂载 pipe，先挂再 finalize 避免丢数据
  const streamed = sendStream(event, archive)

  archive.finalize()

  return streamed
})
