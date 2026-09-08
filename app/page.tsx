import { Suspense } from 'react'
import { DiskManager } from '@/components/DiskManager'
import { ListSkeleton } from '@/components/ListSkeleton'

// 目录状态放在 URL query 上（?path=a/b），因此页面不参与静态预渲染
export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    // useSearchParams 要求 Suspense 边界；首屏骨架与列表加载态一致
    <Suspense
      fallback={
        <main className="main">
          <div className="main-main">
            <ListSkeleton />
          </div>
        </main>
      }
    >
      <DiskManager />
    </Suspense>
  )
}
