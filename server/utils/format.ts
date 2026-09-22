import os from 'node:os'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function formatDate(
  date: Date | string | number | null | undefined,
  fmt = 'YYYY-MM-DD HH:mm:ss'
): string {
  if (!date) {
    return ''
  }

  let value: Date

  if (typeof date === 'string') {
    value = new Date(date.replace(/-/g, '/'))
  } else if (typeof date === 'number') {
    value = new Date(date)
  } else {
    value = date
  }

  if (Number.isNaN(value.getTime())) {
    return ''
  }

  const o: Record<string, number> = {
    'M+': value.getMonth() + 1,
    'D+': value.getDate(),
    'h+': value.getHours() % 12 === 0 ? 12 : value.getHours() % 12,
    'H+': value.getHours(),
    'm+': value.getMinutes(),
    's+': value.getSeconds(),
    'q+': Math.floor((value.getMonth() + 3) / 3),
    S: value.getMilliseconds()
  }

  let result = fmt

  // 用 replace 回调一次性拿到匹配内容，避免依赖过时的 RegExp.$1 全局状态。
  result = result.replace(/(Y+)/g, (match) =>
    `${value.getFullYear()}`.slice(4 - match.length)
  )

  result = result.replace(/(E+)/g, (match) => {
    const prefix = match.length > 2 ? '星期' : match.length > 1 ? '周' : ''
    return prefix + (WEEK[value.getDay()] ?? '')
  })

  for (const k of Object.keys(o)) {
    const value = o[k]
    result = result.replace(new RegExp(`(${k})`, 'g'), (_match, captured: string) => {
      const padded = `00${value}`
      return captured.length === 1 ? `${value}` : padded.slice(-captured.length)
    })
  }

  return result
}

/**
 * 获取本机所有非内部 IPv4 地址，用于启动时打印局域网访问地址。
 * 返回值按「常见局域网网段优先」排序：192.168.* > 10.* > 172.16-31.* > 其它。
 */
export function getLocalIP(): string[] {
  const interfaces = os.networkInterfaces()
  const addresses: string[] = []

  for (const name of Object.keys(interfaces)) {
    for (const item of interfaces[name] || []) {
      if (item && item.family === 'IPv4' && !item.internal) {
        addresses.push(item.address)
      }
    }
  }

  const rank = (ip: string): number => {
    if (ip.startsWith('192.168.')) return 0
    if (ip.startsWith('10.')) return 1
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2
    return 3
  }

  return addresses.sort((a, b) => rank(a) - rank(b))
}
