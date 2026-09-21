import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileItem, ListBody, ListResult } from '#shared/types'
import { appConfig, ensureRoot } from '../utils/config'
import { formatDate } from '../utils/format'
import { resolveSafe, toRelPath } from '../utils/path'

export default defineEventHandler(async (event): Promise<ListResult> => {
  const body = await readBody<ListBody | null>(event)
  const { hasDel } = appConfig()

  const keyword = String(body?.name ?? '').trim().toLowerCase()
  const dirOnly = Boolean(body?.isDirectory)

  ensureRoot()

  const dir = resolveSafe(body?.filePath ?? [])

  // 一次系统调用同时拿到 Dirent（带 isDirectory / isSymbolicLink），
  // 大目录从 N+1 次系统调用降为 1 + N 次并发 stat。
  let entries: import('node:fs').Dirent[]

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    // 目录在运行期被外部删除时自愈，返回空列表而不是报错
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { code: 200, data: [], hasDel }
    }
    throw createError({ statusCode: 500, message: `读取目录失败：${(error as Error).message}` })
  }

  // size / mtime 仍需要 stat。并发执行而非串行 await，
  // 大目录下耗时从 N 次串行系统调用降为一次并发。
  // 使用 stat（而非 lstat）以保持跟随符号链接的原有行为。
  const infos = await Promise.all(
    entries.map((entry) => stat(join(dir, entry.name)).catch(() => null))
  )

  const list: FileItem[] = []

  entries.forEach((entry, index) => {
    const info = infos[index]

    if (!info) {
      return
    }

    // Dirent 已给出 isDirectory，与 stat 二次确认一致；跳过符号链接自身
    const isDirectory = entry.isDirectory() && info.isDirectory()

    list.push({
      name: entry.name,
      isDirectory,
      filePath: toRelPath(join(dir, entry.name)),
      size: (info.size / 1024).toFixed(2),
      birthtime: formatDate(info.birthtime, 'YYYY-MM-DD HH:mm'),
      updatetime: formatDate(info.mtime, 'YYYY-MM-DD HH:mm'),
      mtime: info.mtimeMs, // 时间戳（ms），供前端展示相对时间
      hasDel
    })
  })

  // 目录排在文件前面，同级按本地化规则排序（中文之间按拼音，
  // 中文与英文混排时按 ICU 规则中文在前）
  list.sort(
    (a, b) =>
      Number(b.isDirectory) - Number(a.isDirectory) ||
      a.name.localeCompare(b.name, 'zh-Hans-CN')
  )

  let data = dirOnly ? list.filter((item) => item.isDirectory) : list

  if (keyword) {
    data = data.filter((item) => item.name.toLowerCase().includes(keyword))
  }

  return { code: 200, data, hasDel }
})
