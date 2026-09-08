/**
 * 仅 Node 运行时加载的启动逻辑（由根 instrumentation.ts 条件导入）。
 *
 * 拆分出来是为了让打包器能把 Node 专属代码从 edge 产物中静态剔除，
 * 写法与 Next 官方示例（instrumentation-node）保持一致。
 */
import { appConfig } from '@/lib/server/config'
import { getLocalIP } from '@/lib/server/format'

export function printStartupBanner(): void {
  const { dest, hasDel, port } = appConfig()

  const runningPort = process.env.PORT || port
  const ip = getLocalIP().find((item) => item.startsWith('192')) || 'localhost'

  console.log('')
  console.log(`[disk] 根目录     ${dest}`)
  console.log(`[disk] 删除权限   ${hasDel ? '开启' : '关闭'}`)
  console.log(`[disk] Local      http://localhost:${runningPort}`)
  console.log(`[disk] Network    http://${ip}:${runningPort}`)
  console.log('')
}
