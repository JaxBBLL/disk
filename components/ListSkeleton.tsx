interface ListSkeletonProps {
  rows?: number
}

/**
 * 列表骨架屏。
 * 文件表加载态、路由 loading、页面 Suspense 兜底共用同一份实现。
 */
export function ListSkeleton({ rows = 6 }: ListSkeletonProps) {
  return (
    <div className="skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton-cell skeleton-check" />
          <span className="skeleton-cell skeleton-name" />
          <span className="skeleton-cell skeleton-size" />
          <span className="skeleton-cell skeleton-time" />
        </div>
      ))}
    </div>
  )
}
