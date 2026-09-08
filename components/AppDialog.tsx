'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '@/lib/client/dialog'
import { Transition } from './Transition'

/** 全局 confirm / prompt 对话框，替代原生 window.confirm / window.prompt */
export function AppDialog() {
  const { state, submit, cancel, setValue } = useDialog()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return createPortal(
    <Transition name="modal" show={state.open} duration={300}>
      <div className="modal-mask">
        <div className="modal-wrap dialog" role="dialog" aria-modal="true" aria-label={state.title}>
          <header className="modal-header">{state.title}</header>
          <section className="modal-content dialog-content">
            <p className="dialog-message">{state.message}</p>
            {state.kind === 'prompt' && (
              <input
                className="input dialog-input"
                autoFocus
                value={state.value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submit()
                  }
                }}
              />
            )}
          </section>
          <footer className="modal-footer">
            <button type="button" className="btn" onClick={cancel}>
              取消
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              确定
            </button>
          </footer>
        </div>
      </div>
    </Transition>,
    document.body
  )
}
