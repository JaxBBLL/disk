import { createStore, useStore } from './store'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const store = createStore<ToastItem[]>([])
let seed = 0

function show(message: string, type: ToastType = 'info', duration = 3000): number {
  const id = ++seed

  store.setState((prev) => [...prev, { id, message, type }])

  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }

  return id
}

function dismiss(id: number): void {
  store.setState((prev) => prev.filter((item) => item.id !== id))
}

/** 命令式全局 toast，任意位置可直接调用 */
export const toast = {
  show,
  success: (message: string, duration?: number) => show(message, 'success', duration),
  error: (message: string, duration?: number) => show(message, 'error', duration),
  info: (message: string, duration?: number) => show(message, 'info', duration)
}

/** 组件内获取响应式列表 */
export function useToast() {
  const toasts = useStore(store, (state) => state)

  return { toasts, dismiss }
}
