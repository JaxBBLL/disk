import { customRef } from 'vue'

/** 带防抖的 ref，用于搜索框 */
export function debounceRef<T>(value: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined

  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(val: T) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        value = val
        trigger()
      }, delay)
    }
  }))
}
