/** 把时间戳格式化成相对时间，超出一周回退到日期 */
export function formatRelativeTime(ms?: number | null): string {
  if (!ms) {
    return ''
  }

  const diff = Date.now() - ms
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) {
    return '刚刚'
  }
  if (diff < hour) {
    return `${Math.floor(diff / minute)} 分钟前`
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)} 天前`
  }

  const date = new Date(ms)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}
