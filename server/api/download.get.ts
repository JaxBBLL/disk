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

  if (targets.length === 1 && first) {
    const fileStat = statSync(first)

    if (fileStat.isFile()) {
      setHeader(event, 'Content-Type', 'application/octet-stream')
      setHeader(event, 'Content-Length', fileStat.size)
      setHeader(event, 'Content-Disposition', disposition(basename(first)))
      return sendStream(event, createReadStream(first))
    }
    // 单目录：zip 内根用 basename(t)，zip 文件名也用目录名（用户预期）
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', disposition(`${basename(first)}.zip`))
  } else {
    // 多文件 / 多目录：保持默认命名（含时间戳，多选场景避免文件名碰撞）
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', disposition(`disk-${Date.now()}.zip`))
  }

  // archiver v8 起为纯 ESM 具名导出，使用 ZipArchive 类而非工厂函数
  const archive = new ZipArchive({ zlib: { level: 9 } })

  // 打包过程中若目录里的文件被外部删 / 权限被改，archiver 会以 warning/error 形式抛出，
  // 默认会冒泡到 Nitro 再返回 500；改为只打日志，让本地 zip 局部缺文件即可，
  // 避免整个下载失败（浏览器已开始接收数据，无法重试）。
  archive.on('warning', (error: Error) => {
    console.warn('[disk] zip warning:', error.message)
  })
  archive.on('error', (error: Error) => {
    console.error('[disk] zip error:', error.message)
  })

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
