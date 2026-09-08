import type { Theme } from '@/lib/types'

/** 图标统一走内联 SVG：零依赖、可继承 currentColor，深浅色主题自动适配 */
const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

export function SunIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function MonitorIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...ICON_PROPS} className="check" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** 按当前主题取值展示对应图标 */
export function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return <MoonIcon />
  }
  if (theme === 'light') {
    return <SunIcon />
  }
  return <MonitorIcon />
}
