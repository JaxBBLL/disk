/**
 * 主题下拉用到的图标资源。
 * SVG 文件放在 app/assets/images/，由 Vite 静态打包；
 * import 拿到的是最终 URL，模板里直接 <img :src="..."> 使用。
 *
 * 选择直接用文件而不是 inline <path>：
 * - 文件可单独预览、复用、可被其它组件 import
 * - 不需要再写 svgAttrs() 那类样板
 *
 * 图标颜色硬编码为 #666（与原 --gray-color 接近）。
 * 若以后需要主题感知，可改用 mask-image 模式或 inline SVG。
 */

import sunUrl from '~/assets/images/sun.svg'
import moonUrl from '~/assets/images/moon.svg'
import monitorUrl from '~/assets/images/monitor.svg'
import checkUrl from '~/assets/images/check.svg'

export const ICON_SUN: string = sunUrl
export const ICON_MOON: string = moonUrl
export const ICON_MONITOR: string = monitorUrl
export const ICON_CHECK: string = checkUrl