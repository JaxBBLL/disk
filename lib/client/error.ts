import { toast } from './toast'
import { isApiError } from './request'

/** 统一取错误文案并通过全局 toast 提示 */
export function reportError(error: unknown, fallback = '操作失败'): string {
  const apiError = isApiError(error) ? error : null
  const message = apiError?.message || (error as Error | null)?.message || fallback

  if (typeof window !== 'undefined') {
    toast.error(message)
  }

  return message
}
