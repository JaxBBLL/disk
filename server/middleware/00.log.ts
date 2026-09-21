/**
 * 全局请求日志。
 *
 * 仅记录耗时与状态码（不含 body / query，避免敏感路径被日志留存）。
 * 上传/下载等流式响应以 res.finish 为终点；文件名前缀（00）保证
 * 该中间件早于所有业务中间件与 API 处理，便于看到「真实耗时」。
 *
 * 与 PM2 配合时日志会被 `pm2 logs disk` 接住。
 */
export default defineEventHandler((event) => {
  const start = Date.now()
  const { req, res } = event.node

  // 仅记录 API 与非资源请求；Nuxt 的静态资源、HMR、源映射等噪音很多，
  // 默认过滤掉能显著降低日志量。
  const url = event.path || req.url || ''
  const shouldLog =
    url.startsWith('/api/') ||
    url === '/' ||
    url === '/index.html'

  if (!shouldLog) {
    return
  }

  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    const method = req.method || 'GET'
    const ua = String(req.headers['user-agent'] || '').slice(0, 40)

    // 5xx 用 error，其它用 log；缩进对齐方便 grep
    const line = `[disk] ${method} ${url} ${status} ${duration}ms ua="${ua}"`

    if (status >= 500) {
      console.error(line)
    } else if (status >= 400) {
      console.warn(line)
    } else {
      console.log(line)
    }
  })
})