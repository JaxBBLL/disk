import { existsSync } from 'node:fs'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { appConfig } from './config'

// Windows / Unix 均不允许出现在文件名中的字符
export const ILLEGAL_NAME_CHARS = /[<>:"/\\|?*]/

/** 路径片段，前端既可能传数组也可能传 'a/b' 字符串 */
export type PathInput = string | string[] | null | undefined

function forbidden(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 403 })
}

/** 把前端传来的路径（数组或字符串）拆成安全的路径片段 */
export function toParts(input: PathInput): string[] {
  if (Array.isArray(input)) {
    return input.map(String)
  }
  return String(input ?? '')
    .split('/')
    .filter(Boolean)
}

/**
 * 将前端传入的相对路径解析为磁盘绝对路径，并阻止目录穿越。
 * 所有 API 都必须经过这里，禁止自行 path.join(dest, ...)。
 */
export function resolveSafe(input: PathInput): string {
  const { dest } = appConfig()
  const target = resolve(dest, ...toParts(input))
  const rel = relative(dest, target)

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw forbidden('路径越界')
  }

  return target
}

/** 绝对路径 → 返回给前端的 POSIX 相对路径 */
export function toRelPath(target: string): string {
  const { dest } = appConfig()
  return relative(dest, target).split(sep).join('/')
}

/** 去掉路径分隔符与控制字符，防止上传时利用文件名穿越目录 */
export function safeFileName(name: string): string {
  return (
    String(name ?? '')
      .replace(/[\\/]/g, '_')
      .replace(/\0/g, '')
      .trim() || 'unnamed'
  )
}

/**
 * busboy 已按 utf8 解析文件名；仅当解码确实出现 U+FFFD 替换字符时，
 * 才按 latin1 → utf8 兜底修正（兼容部分客户端的编码差异）。
 */
export function decodeFileName(name: string): string {
  if (!name || !name.includes('�')) {
    return name
  }
  try {
    const fixed = Buffer.from(name, 'latin1').toString('utf8')
    return fixed.includes('�') ? name : fixed
  } catch {
    return name
  }
}

/**
 * 同名文件自动追加 -1 / -2 后缀，对齐原 multer 实现。
 * @param exclude 本批次已占用的名称。
 *   磁盘上的同名文件是异步创建的，同一请求内上传多个同名文件时
 *   existsSync 探测不到，必须用该集合做批次内互斥，否则会互相覆盖。
 */
export function uniqueName(dir: string, fileName: string, exclude: Set<string> = new Set()): string {
  const name = safeFileName(fileName)
  const ext = extname(name)
  const base = basename(name, ext)

  let candidate = name
  let index = 0

  while (exclude.has(candidate) || existsSync(join(dir, candidate))) {
    index += 1
    candidate = `${base}-${index}${ext}`
  }

  exclude.add(candidate)

  return candidate
}

export function assertValidName(name?: string): string {
  const value = String(name ?? '').trim()

  if (!value) {
    throw Object.assign(new Error('名称不能为空'), { statusCode: 400 })
  }
  if (value === '.' || value === '..') {
    throw Object.assign(new Error('名称不合法'), { statusCode: 400 })
  }
  if (ILLEGAL_NAME_CHARS.test(value)) {
    throw Object.assign(new Error('名称包含非法字符'), { statusCode: 400 })
  }

  return value
}
