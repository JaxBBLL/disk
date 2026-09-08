'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/lib/client/toast'
import type { ToastType } from '@/lib/client/toast'

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' }

/** 全局 toast 容器，对应原 app.vue 里挂载的 <Toast /> */
export function Toast() {
  const { toasts, dismiss } = useToast()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || toasts.length === 0) {
    return null
  }

  return createPortal(
    <div className="toast-container">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {ICONS[item.type]}
          </span>
          <span className="toast-message">{item.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="关闭"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
