import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { FileItem, ListBody, ListResult } from '@/lib/types'
import { apiFetch } from './request'
import { reportError } from './error'
import { fileIcon, folderIcon } from './fileIcon'
import { formatRelativeTime } from './time'

/** 搜索框防抖间隔，与原 debounceRef 的默认值一致 */
const KEYWORD_DELAY = 300

/**
 * 文件列表：路径取自路由 query（?path=a/b/c），刷新与前进后退天然可用。
 */
export function useFileList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawPath = searchParams.get('path') ?? ''

  const paths = useMemo(() => rawPath.split('/').filter(Boolean), [rawPath])

  const [list, setList] = useState<FileItem[]>([])
  // 首屏即处于加载态：原 Vue 版用 immediate watch 在首次渲染前就把 loading 置为 true，
  // 这里必须给相同的初值，否则第一帧会先渲染出空状态再切到骨架屏
  const [loading, setLoading] = useState(true)
  const [hasDel, setHasDel] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')

  // 等价于原 debounceRef：输入停止 300ms 后才触发列表请求
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput)
    }, KEYWORD_DELAY)

    return () => clearTimeout(timer)
  }, [keywordInput])

  function decorate(items: FileItem[]): FileItem[] {
    return items.map((item) => ({
      ...item,
      icon: item.isDirectory ? folderIcon(item.name) : fileIcon(item.name),
      relativeTime: formatRelativeTime(item.mtime)
    }))
  }

  const pathKey = paths.join('/')

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const res = await apiFetch<ListResult>('/api/list', {
        method: 'POST',
        body: {
          name: keyword,
          filePath: pathKey ? pathKey.split('/') : []
        } satisfies ListBody
      })

      setList(decorate(res?.data ?? []))
      setHasDel(Boolean(res?.hasDel))
    } catch (error) {
      reportError(error, '读取目录失败')
      setList([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, keyword])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** 跳转目录，写入路由 query */
  const navigate = useCallback(
    (next: string[]) => {
      const path = next.filter(Boolean).join('/')
      router.push(path ? `${pathname}?path=${encodeURIComponent(path)}` : pathname)
    },
    [pathname, router]
  )

  const entryDirectory = useCallback(
    (name: string) => navigate([...paths, name]),
    [navigate, paths]
  )

  return {
    list,
    setList,
    loading,
    setLoading,
    hasDel,
    paths,
    keyword: keywordInput,
    setKeyword: setKeywordInput,
    refresh,
    navigate,
    entryDirectory
  }
}
