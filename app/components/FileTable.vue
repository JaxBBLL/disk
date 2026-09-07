<template>
  <div class="main-main">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="skeleton">
      <div v-for="i in 6" :key="i" class="skeleton-row">
        <span class="skeleton-cell skeleton-check"></span>
        <span class="skeleton-cell skeleton-name"></span>
        <span class="skeleton-cell skeleton-size"></span>
        <span class="skeleton-cell skeleton-time"></span>
      </div>
    </div>

    <table v-else-if="list.length" class="table">
      <thead>
        <tr>
          <th width="30">
            <label class="checkbox">
              <input
                type="checkbox"
                :checked="selectAll"
                :indeterminate="indeterminate"
                @change="onToggleAll"
              />
            </label>
          </th>
          <th class="th-sortable" @click="sortBy('name')">
            名称<span v-if="sortKey === 'name'" class="sort-arrow">{{ sortDir === 1 ? '↑' : '↓' }}</span>
          </th>
          <th width="90" class="th-sortable" @click="sortBy('size')">
            大小<span v-if="sortKey === 'size'" class="sort-arrow">{{ sortDir === 1 ? '↑' : '↓' }}</span>
          </th>
          <th width="110" class="th-sortable" @click="sortBy('mtime')">
            修改时间<span v-if="sortKey === 'mtime'" class="sort-arrow">{{ sortDir === 1 ? '↑' : '↓' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <ContextMenu
          v-for="item in sortedList"
          :key="item.filePath"
          :menu="menu"
          @action="(event, action) => emit('context-action', item, action)"
          @before="emit('context-before', item)"
        >
          <template #default="{ handle }">
            <tr
              draggable="true"
              @dragstart="dragStart(item, $event)"
              @dragover="dropOver(item, $event)"
              @drop="drop(item, $event)"
              @contextmenu="handle"
              @click="toggleItem(item)"
            >
              <td>
                <label class="checkbox child-checkbox" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isSelected(item)"
                    @change="toggleItem(item)"
                  />
                </label>
              </td>
              <td>
                <div
                  class="file-name"
                  @click.stop="item.isDirectory ? emit('open', item) : emit('preview', item)"
                >
                  <img
                    v-if="item.icon"
                    class="icon"
                    :src="item.icon"
                    alt=""
                    width="14"
                    height="14"
                  />
                  <svg
                    v-else
                    class="icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <div class="file-name-text" :title="item.name">{{ item.name }}</div>
                </div>
              </td>
              <td>
                <div v-if="!item.isDirectory">{{ item.size }} KB</div>
              </td>
              <td :title="item.updatetime">{{ item.relativeTime }}</td>
            </tr>
          </template>
        </ContextMenu>
      </tbody>
    </table>

    <!-- 空状态：点击即可上传 -->
    <div v-else class="empty" @click="emit('upload')">
      <svg
        class="empty-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <div class="empty-title">这里还没有文件</div>
      <div class="empty-sub">把文件或文件夹拖到页面任意位置，或点击此处上传</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileItem, MenuItem } from '#shared/types'

type SortKey = 'name' | 'size' | 'mtime'

const props = withDefaults(
  defineProps<{
    list?: FileItem[]
    loading?: boolean
    menu?: MenuItem[]
  }>(),
  {
    list: () => [],
    loading: false,
    menu: () => []
  }
)

const emit = defineEmits<{
  open: [item: FileItem]
  preview: [item: FileItem]
  upload: []
  'drop-move': [origin: FileItem, target: FileItem]
  'context-before': [item: FileItem]
  'context-action': [item: FileItem, action: MenuItem]
}>()

const selected = defineModel<FileItem[]>('selected', { default: () => [] })

const listRef = computed(() => props.list)
const { selectAll, indeterminate } = useSelectAll(listRef, selected)

// ---------- 排序 ----------
const sortKey = ref<SortKey>('name')
const sortDir = ref(1)

const sortedList = computed<FileItem[]>(() => {
  const arr = [...props.list]

  arr.sort((a, b) => {
    // 目录永远排在文件前面
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }

    let result = 0

    if (sortKey.value === 'size') {
      result =
        (a.isDirectory ? 0 : parseFloat(a.size) || 0) -
        (b.isDirectory ? 0 : parseFloat(b.size) || 0)
    } else if (sortKey.value === 'mtime') {
      result = (a.mtime || 0) - (b.mtime || 0)
    } else {
      result = a.name.localeCompare(b.name, 'zh-Hans-CN')
    }

    return result * sortDir.value
  })

  return arr
})

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = -sortDir.value
  } else {
    sortKey.value = key
    sortDir.value = 1
  }
}

const { dragStart, drop, dropOver } = useDrop((origin, target) => {
  emit('drop-move', origin, target)
})

const onToggleAll = (event: Event) => {
  const target = event.target as HTMLInputElement
  selected.value = target.checked ? [...props.list] : []
}

const isSelected = (item: FileItem) =>
  selected.value.some((cur) => cur.filePath === item.filePath)

const toggleItem = (item: FileItem) => {
  selected.value = isSelected(item)
    ? selected.value.filter((cur) => cur.filePath !== item.filePath)
    : [...selected.value, item]
}

// 列表变化后清理已不存在的选择项
watch(listRef, () => {
  selected.value = selected.value.filter((item) =>
    props.list.some((cur) => cur.filePath === item.filePath)
  )
})
</script>
