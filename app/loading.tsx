import { ListSkeleton } from '@/components/ListSkeleton'

/** 路由加载态：与文件表内的骨架屏保持一致 */
export default function Loading() {
  return (
    <main className="main">
      <div className="main-main">
        <ListSkeleton />
      </div>
    </main>
  )
}
