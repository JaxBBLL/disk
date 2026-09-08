'use client'

interface BreadItem {
  depth: number
  name: string
}

interface FileBreadcrumbProps {
  paths?: string[]
  onNavigate: (depth: number) => void
}

/** 「根目录」固定为第一级，后续为逐级目录名 */
export function FileBreadcrumb({ paths = [], onNavigate }: FileBreadcrumbProps) {
  const items: BreadItem[] = [
    { depth: 0, name: '根目录' },
    ...paths.map((name, index) => ({ depth: index + 1, name }))
  ]

  return (
    <div className="bread">
      {items.map((item) =>
        // 点击当前所在层级不触发导航
        item.depth === paths.length ? (
          <span key={item.depth} className="bread-item">
            {item.name}
          </span>
        ) : (
          <span
            key={item.depth}
            className="bread-item"
            onClick={() => onNavigate(item.depth)}
          >
            {item.name}
          </span>
        )
      )}
    </div>
  )
}
