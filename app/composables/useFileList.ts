import type { FileItem, ListBody, ListResult } from '#shared/types'
import { debounceRef } from '~/utils/debounceRef'
import { reportError } from '~/utils/error'
import { formatRelativeTime } from '~/utils/time'

/**
 * 文件列表：路径取自路由 query（?path=a/b/c），刷新与前进后退天然可用。
 *
 * list 用 shallowRef 避免 Vue 给每个 FileItem 创建深响应 Proxy；图标与相对时间
 * 改为模板内按需调用，进一步减少响应体积与首屏 hydrate 成本。
 */
export function useFileList() {
  const route = useRoute()
  const router = useRouter()

  const list = shallowRef<FileItem[]>([])
  const loading = ref(false)
  const hasDel = ref(false)
  const keyword = debounceRef('')

  const paths = computed<string[]>(() =>
    String(route.query.path ?? '')
      .split('/')
      .filter(Boolean)
  )

  async function refresh(): Promise<void> {
    loading.value = true

    try {
      const res = await $fetch<ListResult>('/api/list', {
        method: 'POST',
        body: { name: keyword.value, filePath: paths.value } satisfies ListBody
      })

      // shallowRef 的内部数组不会被深度代理；markRaw 防止 Vue 把这个数组再包一层 Proxy，
      // 后续重排 / 选择操作的性能更好。
      list.value = markRaw(res?.data ?? [])
      hasDel.value = Boolean(res?.hasDel)
    } catch (error) {
      reportError(error, '读取目录失败')
      list.value = markRaw([])
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

  // 暴露 formatRelativeTime 给模板复用，避免组件自己再 import。
  return {
    list,
    loading,
    hasDel,
    paths,
    keyword,
    refresh,
    navigate,
    entryDirectory,
    formatRelativeTime
  }
}