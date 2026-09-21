/**
 * 主题工具：单一权威实现，plugin 与页面共用。
 *
 * 设计要点：
 * - 浏览器首屏没有 SSR，但仍由 client plugin 在挂载前同步设置 data-theme，
 *   避免首屏浅色 → 深色抖动。
 * - 页面里只允许通过 setTheme() 修改主题；onMounted 不再重复读 localStorage，
 *   否则会覆盖 plugin 已经写入的 data-theme。
 */
import type { Theme } from '#shared/types'

const STORAGE_KEY = 'disk-theme'

const VALID_THEMES: readonly Theme[] = ['light', 'dark', 'system']

/** 从 localStorage 读取合法主题；非法值回退 system。**
 * SSR/无 window 时返回 system。
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return (VALID_THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system'
  } catch {
    return 'system'
  }
}

/** 把主题持久化到 localStorage；不抛错。 */
export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage 不可用（如隐私模式）静默忽略，不阻断主题切换
  }
}

/** 'system' 解析为实际生效的浅/深 */
function resolveEffective(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') {
      return 'light'
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/** 应用主题：写入 data-theme 属性，不依赖 ref / reactive。 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.setAttribute('data-theme', resolveEffective(theme))
}