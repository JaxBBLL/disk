/**
 * 生产启动器：读取 config.json 中的 port，再启动 Nitro 服务。
 *
 * 基准目录 = 本脚本所在的目录（而非 cwd），保证无论从哪个目录启动，
 * 都读取本目录内的 config.json，且 dest 相对本目录解析。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = 3000

const baseDir = dirname(fileURLToPath(import.meta.url))

// 传给 server/utils/config.js，让 dest / config.json 都以 baseDir 为基准
process.env.DISK_BASE_DIR = baseDir

function readPort() {
  const file = join(baseDir, 'config.json')

  if (!existsSync(file)) {
    return DEFAULT_PORT
  }

  try {
    return Number(JSON.parse(readFileSync(file, 'utf-8')).port) || DEFAULT_PORT
  } catch {
    return DEFAULT_PORT
  }
}

const port = readPort()

// Nitro 依次读取 NITRO_PORT / PORT
process.env.PORT = process.env.PORT || String(port)
process.env.NITRO_PORT = process.env.NITRO_PORT || String(port)
// 局域网访问需要监听所有网卡
process.env.HOST = process.env.HOST || '0.0.0.0'

// 相对 start.mjs 所在目录加载构建产物
await import(new URL('./.output/server/index.mjs', import.meta.url).href)
