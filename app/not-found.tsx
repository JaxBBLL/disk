import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="main">
      <div className="main-main">
        <div className="empty">
          <div className="empty-title">页面不存在</div>
          <div className="empty-sub">你访问的地址没有对应的内容</div>
          <div className="state-actions">
            <Link className="btn btn-primary" href="/">
              返回文件列表
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
