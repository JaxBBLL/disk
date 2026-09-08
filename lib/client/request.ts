/**
 * 统一的前端请求出口，替代原项目的 ofetch $fetch。
 * 错误被规范化成 { status, message, data }，reportError 因此不需要感知 HTTP 细节。
 */
export interface ApiError {
  status: number
  message: string
  data?: unknown
}

export interface RequestOptions {
  method?: 'POST' | 'GET'
  body?: Record<string, unknown> | FormData
}

export function isApiError(error: unknown): error is ApiError {
  return typeof (error as ApiError | null)?.status === 'number'
}

async function parseMessage(res: Response): Promise<{ message: string; data?: unknown }> {
  const text = await res.text().catch(() => '')

  if (!text) {
    return { message: res.statusText || '请求失败' }
  }

  try {
    const json = JSON.parse(text) as { message?: string; data?: unknown }
    return { message: json?.message || text, data: json?.data }
  } catch {
    return { message: text }
  }
}

export async function apiFetch<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method: options.method ?? 'GET' }
  const body = options.body

  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  const res = await fetch(url, init)

  if (!res.ok) {
    const { message, data } = await parseMessage(res)
    throw { status: res.status, message, data } satisfies ApiError
  }

  return (await res.json()) as T
}
