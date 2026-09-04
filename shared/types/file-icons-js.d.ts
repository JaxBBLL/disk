/**
 * file-icons-js 未提供类型定义，这里给出本项目实际用到的最小声明。
 * 该包是纯浏览器端依赖（依赖 DOM 探测字体），因此只在 app 侧使用。
 */
declare module 'file-icons-js' {
  /** 返回可拼到 class 上的图标类名，无匹配图标时返回 null */
  export function getClass(name: string): string | null
  export function getClassWithColor(name: string): string | null
  export function getIcon(name: string): string
  const _default: {
    getClass: typeof getClass
    getClassWithColor: typeof getClassWithColor
    getIcon: typeof getIcon
  }
  export default _default
}
