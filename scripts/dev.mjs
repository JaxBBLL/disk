/**
 * 开发启动器：确定端口后启动 next dev。
 *
 * Next 没有 nuxt.config 里 devServer.port 那样的内联端口配置，
 * 所以在这里读配置并透传 -p，保证开发/生产端口一致。
 * 端口优先级：PORT 环境变量 > config.json > 3000（与 start.mjs 一致）。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = 3000

const baseDir = join(dirname(fileURLToPath(import.meta.url)), '..')

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

const port = process.env.PORT || readPort()
const nextBin = join(baseDir, 'node_modules', 'next', 'dist', 'bin', 'next')

const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(port), '-H', '0.0.0.0'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // 让 dest / config.json 都相对项目根目录解析
    DISK_BASE_DIR: baseDir
  }
})

child.on('exit', (code) => process.exit(code ?? 0))
