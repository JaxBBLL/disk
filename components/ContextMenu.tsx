'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItem } from '@/lib/types'
import { Transition } from './Transition'

interface ContextMenuProps {
  menu?: MenuItem[]
  onAction: (event: ReactMouseEvent, item: MenuItem) => void
  /** 菜单展开前触发，父组件据此按需重建菜单项 */
  onBefore: (event: ReactMouseEvent) => void
  children: (handle: (event: ReactMouseEvent) => void) => ReactNode
}

/**
 * 右键菜单：children 为 render prop，拿到 handle 后绑定到任意元素的 onContextMenu。
 * 菜单通过 portal 挂到 body，并自动避开视口右/下边界。
 */
export function ContextMenu({ menu = [], onAction, onBefore, children }: ContextMenuProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const pending = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showMenu = (event: ReactMouseEvent) => {
    onBefore(event)
    event.preventDefault()
    event.stopPropagation()

    // 提前取出坐标，避免后续异步测量时事件对象已失效
    pending.current = { x: event.clientX, y: event.clientY }
    setVisible(true)
    setPosition({ x: event.clientX, y: event.clientY })
  }

  // 菜单渲染出来后再按实际尺寸做边界避让
  useEffect(() => {
    if (!visible || !pending.current) {
      return
    }

    const el = menuRef.current

    if (!el) {
      return
    }

    const { x, y } = pending.current
    pending.current = null

    setPosition({
      x: window.innerWidth - x < el.offsetWidth ? window.innerWidth - el.offsetWidth : x,
      y: window.innerHeight - y < el.offsetHeight ? window.innerHeight - el.offsetHeight : y
    })
  }, [visible, menu])

  useEffect(() => {
    const hide = (event: Event) => {
      // 菜单内部的点击交给菜单项自己处理，避免提前卸载导致点击丢失
      if (menuRef.current?.contains(event.target as Node)) {
        return
      }
      setVisible(false)
    }

    window.addEventListener('click', hide, true)
    window.addEventListener('contextmenu', hide, true)

    return () => {
      window.removeEventListener('click', hide, true)
      window.removeEventListener('contextmenu', hide, true)
    }
  }, [])

  const handleMenuItemClick = (event: ReactMouseEvent, item: MenuItem) => {
    setVisible(false)
    onAction(event, item)
  }

  return (
    <>
      {children(showMenu)}
      {mounted &&
        createPortal(
          <Transition name="menu-fade" show={visible} duration={300}>
            <div
              ref={menuRef}
              className="menu"
              role="menu"
              style={{ top: `${position.y}px`, left: `${position.x}px` }}
            >
              {menu.map((item, index) => (
                <button
                  key={`${item.action}-${index}`}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={(event) => handleMenuItemClick(event, item)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Transition>,
          document.body
        )}
    </>
  )
}
