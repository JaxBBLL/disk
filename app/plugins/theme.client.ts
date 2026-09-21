import { applyTheme, getStoredTheme } from '~/utils/theme'

/**
 * 应用启动前根据本地存储设置主题，避免首屏闪烁。
 * 跟随系统时订阅 prefers-color-scheme 变化，自动同步。
 */
export default defineNuxtPlugin(() => {
  applyTheme(getStoredTheme())

  // 仅在 system 模式下才有意义；切换到 light/dark 时再读 localStorage 判断
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    })
})