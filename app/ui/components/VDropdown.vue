<template>
  <!--
    通用下拉组件（VDropdown）：
    - 默认 hover 触发（鼠标离开 trigger 与菜单后才关闭，鼠标移到菜单上不会闪烁）
    - 也支持 click 触发（点 trigger 切换 / 点外部关闭）
    - Teleport 到 body，避免父容器的 overflow:hidden 裁掉菜单
    - 自动按 trigger 元素定位；贴右边/底边时自动翻转
    - slot：#trigger 必填；#item 自定义渲染，不填则按 item.label 输出
    - 通过 emit('select', item, index) / emit('open-change', open) 与父组件通信
  -->
  <div
    ref="triggerRef"
    class="v-dropdown"
    @mouseenter="onTriggerEnter"
    @mouseleave="onTriggerLeave"
    @click="onTriggerClick"
  >
    <slot name="trigger" />

    <Teleport to="body">
      <Transition name="v-dropdown-fade">
        <div
          v-if="open"
          ref="menuRef"
          class="v-dropdown-menu"
          :style="menuStyle"
          @mouseenter="onMenuEnter"
          @mouseleave="onMenuLeave"
          @click.stop
        >
          <div
            v-for="(item, index) in items"
            :key="getKey(item, index)"
            class="v-dropdown-item"
            :class="{
              active: item.active,
              disabled: item.disabled
            }"
            @click="select(item, index)"
          >
            <slot name="item" :item="item" :index="index">
              {{ item.label }}
            </slot>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

export interface VDropdownItem {
  /** 唯一 key，未提供则降级用 index */
  key?: string | number
  label?: string
  /** 高亮态（用于"当前选项"展示） */
  active?: boolean
  /** 禁用态 */
  disabled?: boolean
  /** 前置图标（路径 d 字符串），由调用方在 #item slot 内自由渲染 */
  icon?: string
  /** 透传给 #item slot 的其他自定义字段 */
  [extra: string]: unknown
}

const props = withDefaults(
  defineProps<{
    items?: VDropdownItem[]
    /** hover：鼠标进出触发；click：点击触发 */
    trigger?: 'hover' | 'click'
    /** 菜单相对 trigger 的对齐方式 */
    placement?: 'bottom-start' | 'bottom-end'
    /** 关闭延迟（ms），给鼠标从 trigger 移到 menu 留缓冲 */
    hideDelay?: number
  }>(),
  {
    items: () => [],
    trigger: 'hover',
    placement: 'bottom-start',
    hideDelay: 120
  }
)

const emit = defineEmits<{
  select: [item: VDropdownItem, index: number]
  'open-change': [open: boolean]
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

/** 鼠标在 trigger 或 menu 上才视为"还在菜单内" */
let hoverInside = false
let closeTimer: ReturnType<typeof setTimeout> | null = null

function getKey(item: VDropdownItem, index: number): string | number {
  return item.key ?? index
}

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function setOpen(value: boolean) {
  if (open.value === value) {
    return
  }
  open.value = value
  emit('open-change', value)
}

function select(item: VDropdownItem, index: number) {
  if (item.disabled) {
    return
  }
  emit('select', item, index)
  // 点击后默认关闭
  hoverInside = false
  setOpen(false)
}

// ---------- 定位 ----------
const menuStyle = ref<Record<string, string>>({})

async function updatePosition() {
  await nextTick()
  const trigger = triggerRef.value
  const menu = menuRef.value
  if (!trigger || !menu) {
    return
  }

  const rect = trigger.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 4

  let top = rect.bottom + gap
  let left: number

  if (props.placement === 'bottom-end') {
    left = rect.right - menuRect.width
  } else {
    left = rect.left
  }

  // 横向溢出：贴右/贴左翻转
  if (left + menuRect.width > vw - 4) {
    left = vw - menuRect.width - 4
  }
  if (left < 4) {
    left = 4
  }

  // 纵向溢出：贴底时改为菜单在 trigger 上方
  if (top + menuRect.height > vh - 4) {
    top = rect.top - menuRect.height - gap
  }
  if (top < 4) {
    top = 4
  }

  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    // 第一次测量后写入 min-width，对齐 trigger
    'min-width': `${rect.width}px`
  }
}

// 打开后立即定位；菜单尺寸变化（如 image load）后再算
watch(open, async (value) => {
  if (value) {
    await updatePosition()
    // 字体/图标回流后再算一次，避免初次宽度为 0
    requestAnimationFrame(() => updatePosition())
  }
})

// 滚动 / 视口变化时重新定位
const onWindowChange = () => {
  if (open.value) {
    void updatePosition()
  }
}

// ---------- hover 触发 ----------
function onTriggerEnter() {
  if (props.trigger !== 'hover') {
    return
  }
  hoverInside = true
  clearCloseTimer()
  setOpen(true)
}

function onTriggerLeave() {
  if (props.trigger !== 'hover') {
    return
  }
  hoverInside = false
  scheduleClose()
}

function onMenuEnter() {
  if (props.trigger !== 'hover') {
    return
  }
  hoverInside = true
  clearCloseTimer()
}

function onMenuLeave() {
  if (props.trigger !== 'hover') {
    return
  }
  hoverInside = false
  scheduleClose()
}

function scheduleClose() {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    if (!hoverInside) {
      setOpen(false)
    }
  }, props.hideDelay)
}

// ---------- click 触发 ----------
function onTriggerClick(event: MouseEvent) {
  if (props.trigger !== 'click') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  setOpen(!open.value)
}

function onDocClick(event: MouseEvent) {
  if (!open.value || props.trigger !== 'click') {
    return
  }
  const target = event.target as Node | null
  if (!target) {
    return
  }
  if (triggerRef.value?.contains(target)) {
    return
  }
  if (menuRef.value?.contains(target)) {
    return
  }
  setOpen(false)
}

function onDocKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    setOpen(false)
  }
}

watch(
  () => props.trigger,
  (trigger) => {
    if (trigger === 'click') {
      document.addEventListener('click', onDocClick)
      document.addEventListener('keydown', onDocKey)
      window.addEventListener('resize', onWindowChange)
      window.addEventListener('scroll', onWindowChange, true)
    } else {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onDocKey)
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('scroll', onWindowChange, true)
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearCloseTimer()
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})
</script>

<style scoped>
.v-dropdown {
  display: inline-block;
  position: relative;
}

.v-dropdown-menu {
  z-index: 200;
  padding: 5px 0;
  background-color: var(--surface-color);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.v-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  color: var(--text-color);
  user-select: none;
}

.v-dropdown-item:hover {
  background-color: var(--light-color);
  color: var(--primary-color);
}

.v-dropdown-item.active {
  color: var(--primary-color);
}

.v-dropdown-item.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.v-dropdown-item.disabled:hover {
  background: transparent;
  color: var(--text-color);
}

.v-dropdown-fade-enter-active,
.v-dropdown-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.v-dropdown-fade-enter-from,
.v-dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>