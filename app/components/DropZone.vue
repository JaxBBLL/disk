<template>
  <div
    class="dropzone"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <slot />

    <Transition name="dropzone-fade">
      <div v-if="active" class="dropzone-mask">
        <div class="dropzone-card">
          <svg
            class="dropzone-icon"
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
          <div class="dropzone-title">松开鼠标，上传到「{{ target }}」</div>
          <div class="dropzone-sub">支持文件与文件夹，自动保留目录层级</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { collectDropEntries, walkDropEntry } from '~/utils/file'
import type { DropItem } from '~/utils/file'

const props = withDefaults(defineProps<{ target?: string }>(), {
  target: ''
})

const emit = defineEmits<{
  'drop-files': [items: DropItem[]]
}>()

const active = ref(false)
let depth = 0

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types || []).includes('Files')

const onDragEnter = (event: DragEvent) => {
  if (!hasFiles(event)) {
    return
  }
  // 计数器法：dragenter/dragleave 在子元素间移动时会成对触发，
  // 用计数而不是布尔值才能避免遮罩闪烁
  depth += 1
  active.value = true
}

const onDragOver = (event: DragEvent) => {
  if (!hasFiles(event)) {
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const onDragLeave = () => {
  depth = Math.max(0, depth - 1)
  if (!depth) {
    active.value = false
  }
}

async function onDrop(event: DragEvent) {
  if (!hasFiles(event)) {
    return
  }
  event.preventDefault()
  depth = 0
  active.value = false

  // 同步收集 entry（事件结束后 dataTransfer 失效），再异步展开目录树
  const entries = collectDropEntries(event.dataTransfer)

  if (!entries.length) {
    return
  }

  const items: DropItem[] = []
  for (const entry of entries) {
    items.push(...(await walkDropEntry(entry, '')))
  }

  if (items.length) {
    emit('drop-files', items)
  }
}
</script>

<style scoped>
.dropzone {
  position: relative;
}

/* 遮罩覆盖整个视口，pointer-events:none 让拖放事件继续落到容器本身 */
.dropzone-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(42, 168, 112, 0.1);
  pointer-events: none;
}

.dropzone-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 56px;
  background: var(--surface-color);
  border: 2px dashed var(--primary-color);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14);
  color: var(--primary-color);
  text-align: center;
}

.dropzone-icon {
  margin-bottom: 12px;
}

.dropzone-title {
  font-size: 16px;
  color: var(--text-color);
}

.dropzone-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--gray-color);
}

.dropzone-fade-enter-active,
.dropzone-fade-leave-active {
  transition: opacity 0.15s ease;
}

.dropzone-fade-enter-from,
.dropzone-fade-leave-to {
  opacity: 0;
}
</style>
