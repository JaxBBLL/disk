/**
 * 启动钩子（等价原项目 server/plugins/00.config.ts）。
 *
 * Next 会为 nodejs 与 edge 两种运行时各编译一次 instrumentation，
 * 把 Node 侧逻辑放进 `NEXT_RUNTIME === 'nodejs'` 分支内，
 * 打包器才能把它从 edge 产物里静态剔除（否则会报 node: 协议无法解析）。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { printStartupBanner } = await import('./instrumentation-node')

    printStartupBanner()
  }
}
