import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import type { FileItem } from '#shared/types'

/**
 * 全选 / 半选状态。list 与 selected 均为 ref 或 getter。
 * 相比原实现用 watch 同步，这里直接用 computed 派生，不会出现状态滞后。
 */
export function useSelectAll(
  list: MaybeRefOrGetter<FileItem[]>,
  selected: Ref<FileItem[]>
) {
  const selectAll = computed({
    get: () => toValue(list).length > 0 && selected.value.length === toValue(list).length,
    set: (value: boolean) => {
      selected.value = value ? [...toValue(list)] : []
    }
  })

  const indeterminate = computed(
    () => selected.value.length > 0 && selected.value.length !== toValue(list).length
  )

  return { selectAll, indeterminate }
}
