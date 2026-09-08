// 主题工具不含 hook、也不在模块顶层访问 DOM，因此未加 'use client'，
// layout（服务端组件）可以直接取用其中的防闪烁脚本。
import type { Theme } from '@/lib/types'

/** 主题在 localStorage 中的键名，与原项目保持一致 */
export const THEME_KEY = 'disk-theme'

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 'system' 折算为实际生效的主题 */
export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return prefersDark() ? 'dark' : 'light'
  }
  return theme
}

/** 读取本地持久化的主题，缺省 system */
export function readTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)

  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
}

/** 应用到 <html data-theme>，这也是深浅色变量的唯一开关 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', effectiveTheme(theme))
}

/**
 * 跟随系统：仅在用户选择 system 时同步切换。
 * 返回取消监听的函数（等价于原 theme.client.ts 插件里的监听）。
 */
export function watchSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (localStorage.getItem(THEME_KEY) === 'system') {
      applyTheme('system')
    }
  }

  media.addEventListener('change', onChange)

  return () => media.removeEventListener('change', onChange)
}

/**
 * 首屏防闪烁脚本：必须在 CSS 生效前同步执行，因此以字符串形式内联到 <head>。
 */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()`
