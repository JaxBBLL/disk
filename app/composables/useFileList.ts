import * as FileIcons from 'file-icons-js'
import type { FileItem, ListBody, ListResult } from '#shared/types'
import { debounceRef } from '~/utils/debounceRef'
import { reportError } from '~/utils/error'
import { formatRelativeTime } from '~/utils/time'

/**
 * 文件列表：路径取自路由 query（?path=a/b/c），刷新与前进后退天然可用。
 */
export function useFileList() {
  const route = useRoute()
  const router = useRouter()

  const list = ref<FileItem[]>([])
  const loading = ref(false)
  const hasDel = ref(false)
  const keyword = debounceRef('')

  const paths = computed<string[]>(() =>
    String(route.query.path ?? '')
      .split('/')
      .filter(Boolean)
  )

  function decorate(items: FileItem[]): FileItem[] {
    return items.map((item) => ({
      ...item,
      icon: import.meta.client ? (FileIcons.getClassWithColor(item.name) ?? '') : '',
      relativeTime: formatRelativeTime(item.mtime)
    }))
  }

  async function refresh(): Promise<void> {
    loading.value = true

    try {
      const res = await $fetch<ListResult>('/api/list', {
        method: 'POST',
        body: { name: keyword.value, filePath: paths.value } satisfies ListBody
      })

      list.value = decorate(res?.data ?? [])
      hasDel.value = Boolean(res?.hasDel)
    } catch (error) {
      reportError(error, '读取目录失败')
      list.value = []
    } finally {
      loading.value = false
    }
  }

  /** 跳转目录，写入路由 query */
  function navigate(next: string[]): void {
    const path = next.filter(Boolean).join('/')
    router.push({ query: path ? { path } : {} })
  }

  const entryDirectory = (name: string) => navigate([...paths.value, name])

  watch([() => route.query.path, keyword], refresh, { immediate: true })

  return {
    list,
    loading,
    hasDel,
    paths,
    keyword,
    refresh,
    navigate,
    entryDirectory
  }
}
