/** 应用启动前根据本地存储设置主题，避免首屏闪烁 */
export default defineNuxtPlugin(() => {
  const saved = localStorage.getItem('disk-theme')
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light')
})
