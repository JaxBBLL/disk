'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/** 路由级错误边界：渲染异常时给出提示并允许重试 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[disk] 页面渲染失败：', error)
  }, [error])

  return (
    <main className="main">
      <div className="main-main">
        <div className="empty">
          <div className="empty-title">页面出错了</div>
          <div className="empty-sub">{error.message || '请稍后重试'}</div>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={reset}>
              重试
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
