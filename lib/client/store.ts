import { useSyncExternalStore } from 'react'

/**
 * 极简外部 store，用来承载原项目里的「模块级 ref / reactive」全局状态
 * （toast 队列、对话框）。命令式调用方式与原 Vue 实现保持一致，
 * 组件侧通过 useSyncExternalStore 订阅，避免 Context 层层透传。
 */
export interface Store<T> {
  getState: () => T
  setState: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState: (next) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next

      if (value === state) {
        return
      }

      state = value
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

/**
 * 订阅 store 的切片。selector 必须返回稳定引用（或直接返回 state 本身），
 * 否则 useSyncExternalStore 的 Object.is 比较会反复触发。
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const snapshot = () => selector(store.getState())

  return useSyncExternalStore(store.subscribe, snapshot, snapshot)
}
