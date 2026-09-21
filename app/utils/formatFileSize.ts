/**
 * 字节数 → 人类可读字符串。
 *
 * 阈值（按 1024 进位）：
 * - < 1 KB          → "512 B"
 * - < 1 MB          → "12.34 KB"
 * - < 1 GB          → "5.67 MB"
 * - ≥ 1 GB          → "1.23 GB"
 *
 * 目录固定传入 0，前端可对目录短路返回空字符串。
 */

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return ''
  }
  if (bytes <= 0) {
    return '0 B'
  }

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`
  }
  if (bytes >= KB) {
    return `${(bytes / KB).toFixed(2)} KB`
  }
  return `${bytes} B`
}