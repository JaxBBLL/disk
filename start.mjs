/**
 * 生产启动器：读取 config.json 中的 port / bind，再启动 Nitro 服务。
 *
 * 基准目录 = 本脚本所在的目录（而非 cwd），保证无论从哪个目录启动，
 * 都读取本目录内的 config.json，且 dest 相对本目录解析。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = 3000
const DEFAULT_BIND = '0.0.0.0'

const baseDir = dirname(fileURLToPath(import.meta.url))

// 传给 server/utils/config.js，让 dest / config.json 都以 baseDir 为基准
process.env.DISK_BASE_DIR = baseDir

function readRuntimeConfig() {
  const file = join(baseDir, 'config.json')

  if (!existsSync(file)) {
    return { port: DEFAULT_PORT, bind: DEFAULT_BIND }
  }

  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    return {
      port: Number(raw.port) || DEFAULT_PORT,
      // 仅当 bind 是字符串时才采用，避免被错误值（如 number）污染
      bind: typeof raw.bind === 'string' && raw.bind ? raw.bind : DEFAULT_BIND
    }
  } catch {
    return { port: DEFAULT_PORT, bind: DEFAULT_BIND }
  }
}

const { port, bind } = readRuntimeConfig()

// Nitro 依次读取 NITRO_PORT / PORT
process.env.PORT = process.env.PORT || String(port)
process.env.NITRO_PORT = process.env.NITRO_PORT || String(port)
// 监听地址：HOST 环境变量 > config.json.bind > 默认 0.0.0.0
process.env.HOST = process.env.HOST || bind

// 相对 start.mjs 所在目录加载构建产物
await import(new URL('./.output/server/index.mjs', import.meta.url).href)
