import 'server-only'

import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Route Handler 适配层。
 *
 * 原项目直接使用 Nitro 的 defineEventHandler / readBody / getQuery /
 * setHeader / sendStream / createError，这里给出 Next 版的等价替代，
 * 让业务代码（含抛错语义）保持原样：
 * - 抛错统一转为 `{ message, data? }` JSON + 对应状态码，
 *   前端 reportError 的取值链路（data.message）因此保持不变；
 * - 流式响应通过 Readable.toWeb 交给 Web Response。
 */

/** 业务异常：替代 Nitro 的 createError */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data?: unknown
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

interface ErrorLike {
  statusCode?: number
  status?: number
  data?: unknown
  message?: string
}

/** 统一的 JSON 响应（Next 惯用写法） */
export function json(body: unknown, init: ResponseInit = {}): Response {
  return NextResponse.json(body, init)
}

/** 统一的错误响应：始终带 message，保证前端能拿到可读文案 */
export function fail(status: number, message: string, data?: unknown): Response {
  return NextResponse.json(data === undefined ? { message } : { message, data }, { status })
}

/** 读取 JSON 请求体；空体或损坏时返回 null，由调用方决定报错口径 */
export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    const text = await req.text()

    if (!text) {
      return null
    }

    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/** Node 可读流 → Web 响应体 */
export function nodeToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>
}

export type ApiHandler = (req: NextRequest) => Promise<Response> | Response

/**
 * 包裹 Route Handler 的业务逻辑：
 * - HttpError 与带 statusCode/status 的错误（lib/server/path.ts 抛的就是这种）
 *   按原状态码返回；
 * - 其余异常按 500 返回原始 message，对齐 Nitro 的默认行为。
 */
export async function handle(req: NextRequest, handler: ApiHandler): Promise<Response> {
  try {
    return await handler(req)
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.status, error.message, error.data)
    }

    const err = (error ?? null) as ErrorLike | null
    const status =
      typeof err?.statusCode === 'number'
        ? err.statusCode
        : typeof err?.status === 'number'
          ? err.status
          : 500

    return fail(status, err?.message || '服务器内部错误', err?.data)
  }
}
