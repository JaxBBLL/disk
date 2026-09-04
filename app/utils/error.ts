import { toast } from '~/composables/useToast'

/** ofetch 抛出的错误形状，只需要读取文案 */
interface ErrorLike {
  data?: { message?: string }
  statusMessage?: string
  message?: string
}

/** 统一取错误文案并通过全局 toast 提示 */
export function reportError(error: unknown, fallback = '操作失败'): string {
  const err = (error ?? null) as ErrorLike | null
  const message = err?.data?.message || err?.statusMessage || err?.message || fallback

  if (import.meta.client) {
    toast.error(message)
  }

  return message
}
