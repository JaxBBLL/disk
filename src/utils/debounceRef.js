import { customRef } from 'vue'

export function debounceRef(value, delay = 300) {
  let timer
  return customRef((track, trigger) => {
    // 获得 track, trigger 函数
    return {
      get() {
        // 依赖收集 track()
        track()
        return value
      },
      set(val) {
        clearTimeout(timer)
        timer = setTimeout(() => {
          value = val
          // 派发更新 trigger()
          trigger()
        }, delay)
      }
    }
  })
}
