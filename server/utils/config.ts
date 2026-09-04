import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** 运行配置，对应运行目录下的 config.json */
export interface AppConfig {
  /** 文件根目录，绝对路径或相对运行目录的路径（读取后统一解析为绝对路径） */
  dest: string
  /** 是否允许删除 */
  hasDel: boolean
  /** 端口 */
  port: number
}

export const DEFAULT_CONFIG: Readonly<AppConfig> = Object.freeze({
  dest: './disk',
  hasDel: true,
  port: 3000
})

let cached: AppConfig | null = null

/**
 * 读取 config.json，结果在进程内缓存。
 * 基准目录：生产环境由 start.mjs 注入 DISK_BASE_DIR（= dist 目录），
 * 开发环境（nuxt dev）没有该变量，回退到 cwd（= 项目根目录）。
 * 这样 dest 始终相对「配置所在目录」解析，不再依赖启动时所在的 cwd。
 */
export function loadConfig(): AppConfig {
  if (cached) {
    return cached
  }

  const baseDir = process.env.DISK_BASE_DIR || process.cwd()
  const file = join(baseDir, 'config.json')
  let raw: AppConfig = { ...DEFAULT_CONFIG }

  if (existsSync(file)) {
    try {
      raw = {
        ...DEFAULT_CONFIG,
        ...(JSON.parse(readFileSync(file, 'utf-8')) as Partial<AppConfig>)
      }
    } catch (error) {
      console.warn(`[disk] config.json 解析失败，回退默认配置：${(error as Error).message}`)
    }
  } else {
    writeFileSync(file, JSON.stringify(DEFAULT_CONFIG, null, 2))
    console.log('[disk] 已创建配置文件 config.json')
  }

  cached = { ...raw, dest: resolve(baseDir, raw.dest) }

  return cached
}

export function appConfig(): AppConfig {
  return loadConfig()
}

/**
 * 保证根目录存在。在运行期根目录被外部删除时调用，使服务自愈。
 */
export function ensureRoot(): string {
  const { dest } = appConfig()
  mkdirSync(dest, { recursive: true })
  return dest
}
