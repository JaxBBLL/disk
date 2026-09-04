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

  if (/(Y+)/.test(result)) {
    result = result.replace(RegExp.$1, `${value.getFullYear()}`.substr(4 - RegExp.$1.length))
  }

  if (/(E+)/.test(result)) {
    result = result.replace(
      RegExp.$1,
      (RegExp.$1.length > 1 ? (RegExp.$1.length > 2 ? '星期' : '周') : '') +
        (WEEK[value.getDay()] ?? '')
    )
  }

  for (const k of Object.keys(o)) {
    if (new RegExp(`(${k})`).test(result)) {
      result = result.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? `${o[k]}` : `00${o[k]}`.substr(`${o[k]}`.length)
      )
    }
  }

  return result
}

/** 获取本机所有非内部 IPv4 地址，用于启动时打印局域网访问地址 */
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

  return addresses
}
