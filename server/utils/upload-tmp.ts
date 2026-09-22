/**
 * 分片上传会话状态管理。
 *
 * 会话 = 一次大文件分片上传全过程，落地为：
 *   {dest}/.upload-tmp/{uploadId}/
 *     ├── 0.part
 *     ├── 1.part
 *     └── ...
 *
 * - 服务端内存 sessions map 记录 totalChunks / chunkSize / fileName / createdAt；
 *   重启服务会让进行中的会话丢失（前端需要重新 init / 重传分片）。
 * - 临时目录的物理存在即"分片已写入"的事实记录，断点续传可用。
 * - merge 完成后 rm 整个临时目录并清 sessions。
 */
import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  openSync,
  closeSync,
  writeSync,
  readSync
} from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { appConfig } from './config'

/** 分片上传会话（一次大文件上传） */
export interface UploadSession {
  uploadId: string
  /** 原始文件名（仅供日志/调试，不参与落盘） */
  fileName: string
  /** 总片数 */
  totalChunks: number
  /** 每片字节数（最后一片可能小于此值） */
  chunkSize: number
  /** 原始文件字节数 */
  fileSize: number
  createdAt: number
}

const sessions = new Map<string, UploadSession>()

/** 会话过期时间：超过此时长未活动的会话在下一次写入时被连同临时目录一起清理 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000

function sweepExpiredSessions(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      rmSync(join(appConfig().dest, '.upload-tmp', id), { recursive: true, force: true })
      sessions.delete(id)
    }
  }
}

let seq = 0
function genUploadId(): string {
  seq = (seq + 1) & 0xffffff
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}-${seq.toString(36)}`
}

export function createSession(opts: {
  fileName: string
  totalChunks: number
  chunkSize: number
  fileSize: number
}): UploadSession {
  sweepExpiredSessions()
  const session: UploadSession = {
    uploadId: genUploadId(),
    ...opts,
    createdAt: Date.now()
  }
  sessions.set(session.uploadId, session)
  return session
}

export function getUploadSession(uploadId: string): UploadSession | undefined {
  return sessions.get(uploadId)
}

export function removeSession(uploadId: string): void {
  sessions.delete(uploadId)
}

/**
 * uploadId 格式白名单：仅允许 genUploadId 产物与历史测试 id 的字符集
 * （字母数字 + 单层连字符），显式排除 `.` `/` `\` 等任何可用于路径穿越的字符。
 * cancel 接口的 uploadId 来自用户输入，必须先过这道闸再拼路径。
 */
const UPLOAD_ID_RE = /^[0-9a-z]+(?:-[0-9a-z]+)*$/i

export function isValidUploadId(uploadId: unknown): uploadId is string {
  return typeof uploadId === 'string' && uploadId.length > 0 && UPLOAD_ID_RE.test(uploadId)
}

/**
 * 临时目录绝对路径；未 init 时不存在。
 * 双重防护：先做格式白名单，再校验 resolve 后仍落在 .upload-tmp 内
 * （且不是 .upload-tmp 自身），杜绝 uploadId 穿越删除目录外内容。
 */
export function getTmpDir(uploadId: string): string {
  if (!isValidUploadId(uploadId)) {
    throw Object.assign(new Error('uploadId 格式非法'), { statusCode: 400 })
  }

  const root = join(appConfig().dest, '.upload-tmp')
  const dir = resolve(root, uploadId)
  const rel = relative(root, dir)

  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw Object.assign(new Error('uploadId 路径越界'), { statusCode: 400 })
  }

  return dir
}

/** 已成功写入的分片 index 数组（来自磁盘；不依赖 sessions map） */
export function getUploadedChunks(uploadId: string): number[] {
  const dir = getTmpDir(uploadId)
  if (!existsSync(dir)) {
    return []
  }
  const result: number[] = []
  for (const name of readdirSync(dir)) {
    const match = /^(\d+)\.part$/.exec(name)
    if (match) {
      result.push(Number(match[1]))
    }
  }
  return result.sort((a, b) => a - b)
}

/** 写入单个分片；index 超出范围或会话不存在抛错 */
export function writeChunk(uploadId: string, index: number, data: Buffer): void {
  const session = getUploadSession(uploadId)
  if (!session) {
    throw Object.assign(new Error('uploadId 无效或已过期'), { statusCode: 404 })
  }
  if (index < 0 || index >= session.totalChunks) {
    throw Object.assign(new Error(`index 越界 (0..${session.totalChunks - 1})`), { statusCode: 400 })
  }
  session.createdAt = Date.now()
  const dir = getTmpDir(uploadId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${index}.part`), data)
}

/**
 * 合并所有分片到 target，校验齐全，删除临时目录。
 * 失败时已合并的部分会回滚（unlink target）。
 */
export function mergeChunks(uploadId: string, totalChunks: number, target: string): void {
  const dir = getTmpDir(uploadId)
  if (!existsSync(dir)) {
    throw Object.assign(new Error('uploadId 无效或临时目录不存在'), { statusCode: 404 })
  }

  const written = new Set(getUploadedChunks(uploadId))
  for (let i = 0; i < totalChunks; i++) {
    if (!written.has(i)) {
      throw Object.assign(new Error(`分片 ${i} 未上传`), { statusCode: 400 })
    }
  }

  const fd = openSync(target, 'w')
  try {
    for (let i = 0; i < totalChunks; i++) {
      const buf = readFileSync(join(dir, `${i}.part`))
      writeSync(fd, buf, 0, buf.length)
    }
  } catch (error) {
    // 合并失败 → 回滚：删除已写入的目标
    try {
      closeSync(fd)
    } catch {
      // fd 已关闭也忽略
    }
    rmSync(target, { force: true })
    throw error
  } finally {
    try {
      closeSync(fd)
    } catch {
      // ignore
    }
  }

  // 清理临时目录与会话记录
  rmSync(dir, { recursive: true, force: true })
  removeSession(uploadId)
}

/**
 * 删除临时目录与 session；幂等（目标不存在时静默）。
 * uploadId 先经 getTmpDir 的白名单 + 收口校验，非法输入抛 400 而非执行删除。
 */
export function cleanupUpload(uploadId: string): void {
  rmSync(getTmpDir(uploadId), { recursive: true, force: true })
  removeSession(uploadId)
}