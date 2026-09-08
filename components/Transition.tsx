'use client'

import { cloneElement, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

interface TransitionProps {
  /** 过渡名，对应 globals.css 里的 `{name}-enter-from` 等类 */
  name: string
  show: boolean
  /** 动画时长（ms），需与 CSS 中的过渡时间保持一致 */
  duration?: number
  children: ReactElement<{ className?: string }>
}

/**
 * Vue <Transition> 的等价物：挂载/卸载时给子元素加上 enter/leave 类，
 * 离场动画播完再真正卸载。不额外包裹 DOM，避免影响布局。
 */
export function Transition({ name, show, duration = 300, children }: TransitionProps) {
  const [mounted, setMounted] = useState(show)
  const [className, setClassName] = useState('')
  const shown = useRef(show)

  useEffect(() => {
    if (show === shown.current) {
      return
    }

    shown.current = show

    if (show) {
      setMounted(true)
      setClassName(`${name}-enter-from`)

      // 两帧后再切到 -enter-active，让浏览器先应用初始态
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setClassName(`${name}-enter-active`))
      })
      const timer = setTimeout(() => setClassName(''), duration + 50)

      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(timer)
      }
    }

    setClassName(`${name}-leave-active ${name}-leave-to`)
    const timer = setTimeout(() => {
      setMounted(false)
      setClassName('')
    }, duration)

    return () => clearTimeout(timer)
  }, [show, name, duration])

  if (!mounted) {
    return null
  }

  return cloneElement(children, {
    className: [children.props.className, className].filter(Boolean).join(' ')
  })
}
