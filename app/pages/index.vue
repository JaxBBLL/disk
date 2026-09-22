<template>
  <ContextMenu
    :menu="menuItems"
    @action="menuAction"
    @before="handleBeforeShow()"
  >
    <template #default="{ handle }">
      <!-- 拖拽区覆盖整页，拖到任意位置都能上传 -->
      <DropZone :target="dropTarget" @drop-files="uploadDropped">
        <div class="app" @contextmenu="handle">
          <header class="header">
            <div class="header-main">
              <FileBreadcrumb :paths="paths" @navigate="gotoBreadcrumb" />
              <input
                v-model="keyword"
                class="input"
                type="text"
                placeholder="搜索"
              />

              <!-- 上传下拉：VDropdown 默认 label 渲染 -->
              <VDropdown
                :items="uploadItems"
                placement="bottom-end"
                @select="onUploadSelect"
              >
                <template #trigger>
                  <span class="btn">上传<span class="caret">▾</span></span>
                </template>
              </VDropdown>

              <!-- 主题下拉：VDropdown + #item slot 自定义渲染（icon + label + check） -->
              <VDropdown
                :items="themeItems"
                placement="bottom-end"
                @select="onThemeSelect"
              >
                <template #trigger>
                  <span class="btn theme-toggle" title="主题模式">
                    <img class="icon-img" :src="themeTriggerIcon" alt="" />
                    <span class="caret">▾</span>
                  </span>
                </template>
                <template #item="{ item }">
                  <img class="icon-img" :src="item.icon" alt="" />
                  <span>{{ item.label }}</span>
                  <img v-if="item.active" class="icon-img check" :src="ICON_CHECK" alt="" />
                </template>
              </VDropdown>
            </div>
          </header>

          <main class="main">
            <!--
              提示文案以水印形式铺满整个页面。
              改用 CSS mask-image 平铺一张 SVG 雪碧图，避免 48 个 span 的 transform 重排。
            -->
            <div class="upload-watermark" aria-hidden="true"></div>

            <FileTable
              v-model:selected="selected"
              :list="list"
              :loading="loading"
              :menu="menuItems"
              @open="(item) => entryDirectory(item.name)"
              @preview="previewItem"
              @upload="pickAndUploadFiles"
              @drop-move="handleDropMove"
              @context-before="handleBeforeShow"
              @context-action="handleRowAction"
            />
          </main>

          <MoveDialog v-model="moveOpen" @submit="submitMove" />
        </div>
      </DropZone>

      <!-- 底部批量操作栏 -->
      <Transition name="batch">
        <div v-if="selected.length" class="batch-bar">
          <span class="batch-count">已选 {{ selected.length }} 项</span>
          <span class="btn-text" @click="downloadItems(selected)">下载</span>
          <span class="btn-text" @click="openMove(selected)">移动</span>
          <span
            v-if="hasDel"
            class="btn-text btn-danger"
            @click="removeItems(selected)"
          >删除</span>
          <span class="btn-text batch-clear" @click="selected = []">取消选择</span>
        </div>
      </Transition>

      <!-- 上传进度提示 -->
      <Transition name="toast">
        <div v-if="uploading" class="upload-progress">
          <span class="spinner" aria-hidden="true"></span>
          <span>{{ uploadingLabel }}</span>
        </div>
      </Transition>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import type { FileItem, MenuItem, Theme } from '#shared/types'
import type { VDropdownItem } from '~/ui/components/VDropdown.vue'
import { applyTheme, getStoredTheme, saveTheme } from '~/utils/theme'
import {
  ICON_CHECK,
  ICON_MOON,
  ICON_MONITOR,
  ICON_SUN
} from '~/utils/theme-icons'

const {
  list,
  loading,
  hasDel,
  paths,
  keyword,
  refresh,
  navigate,
  entryDirectory
} = useFileList()

const {
  uploading,
  uploadingLabel,
  pickAndUploadFiles,
  pickAndUploadFolder,
  uploadDropped,
  downloadItems,
  previewItem,
  renameItem,
  createFolder,
  removeItems,
  moveItems
} = useFileAction({ paths, refresh, loading })

const selected = ref<FileItem[]>([])
const moveOpen = ref(false)
const moveTargets = ref<FileItem[]>([])

const dropTarget = computed(() =>
  paths.value.length ? paths.value.join('/') : '根目录'
)

// 切换目录时清空选择，避免残留上一目录的选中项
watch(paths, () => {
  selected.value = []
})

// ---------- 上传下拉 ----------
const uploadItems: VDropdownItem[] = [
  { key: 'files', label: '上传文件' },
  { key: 'folder', label: '上传文件夹' }
]

function onUploadSelect(item: VDropdownItem) {
  if (item.key === 'files') {
    pickAndUploadFiles()
  } else if (item.key === 'folder') {
    pickAndUploadFolder()
  }
}

// ---------- 主题下拉 ----------
// 初始值与 plugin 同步：plugin 已根据 localStorage 设置了 data-theme。
const theme = ref<Theme>(getStoredTheme())

const themeTriggerIcon = computed(() => {
  if (theme.value === 'dark') return ICON_MOON
  if (theme.value === 'light') return ICON_SUN
  return ICON_MONITOR
})

const themeItems = computed<VDropdownItem[]>(() => [
  { key: 'light', label: '浅色模式', icon: ICON_SUN, active: theme.value === 'light' },
  { key: 'dark', label: '深色模式', icon: ICON_MOON, active: theme.value === 'dark' },
  { key: 'system', label: '跟随系统', icon: ICON_MONITOR, active: theme.value === 'system' }
])

function onThemeSelect(item: VDropdownItem) {
  const value = item.key as Theme
  theme.value = value
  saveTheme(value)
  applyTheme(value)
}

// ---------- 右键菜单 ----------
const menuItems = ref<MenuItem[]>([])

const COMMON_MENU: MenuItem[] = [
  { label: '上传文件', action: '4' },
  { label: '上传文件夹', action: '5' },
  { label: '新建文件夹', action: '6' }
]

function buildMenu(item?: FileItem): MenuItem[] {
  if (!item) {
    return [{ label: '刷新', action: '-1' }, ...COMMON_MENU]
  }

  const head: MenuItem[] = item.isDirectory
    ? [
        { label: '打开', action: '0' },
        { label: '下载文件夹', action: '1' }
      ]
    : [{ label: '下载', action: '1' }]

  const tail: MenuItem[] = [
    { label: '重命名', action: '2' },
    { label: '移动', action: '7' }
  ]

  const del: MenuItem[] = hasDel.value ? [{ label: '删除', action: '3' }] : []

  return [...head, ...tail, ...del, ...COMMON_MENU]
}

const handleBeforeShow = (item?: FileItem) => {
  menuItems.value = buildMenu(item)
}

const menuAction = (event: MouseEvent, item: MenuItem) =>
  handleRowAction(null, item)

function handleRowAction(item: FileItem | null, action: MenuItem) {
  const map: Record<string, () => void> = {
    '-1': () => void refresh(),
    '0': () => item && entryDirectory(item.name),
    '1': () => item && downloadItems([item]),
    '2': () => item && nextTick(() => void renameItem(item)),
    '3': () => item && nextTick(() => void removeItems([item])),
    '4': () => pickAndUploadFiles(),
    '5': () => pickAndUploadFolder(),
    '6': () => nextTick(() => void createFolder()),
    '7': () => item && nextTick(() => openMove([item]))
  }

  map[action?.action]?.()
}

// ---------- 面包屑 ----------
const gotoBreadcrumb = (depth: number) =>
  navigate(depth === 0 ? [] : paths.value.slice(0, depth))

// ---------- 移动 ----------
function openMove(items: FileItem[]) {
  if (!items.length) {
    return
  }
  moveTargets.value = [...items]
  moveOpen.value = true
}

async function submitMove(target: string) {
  await moveItems(moveTargets.value, target)
}

function handleDropMove(origin: FileItem, target: FileItem) {
  if (!origin || !target?.isDirectory) {
    return
  }
  void moveItems([origin], target.filePath)
}
</script>