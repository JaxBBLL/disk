<template>
  <!--
    通用弹窗壳（VModal）：
    - 通过 v-model:modelValue 控制开关；emit('update:modelValue', value)
    - Teleport 到 body，避免被父容器 transform / overflow 影响
    - Esc 关闭（escClose=true）
    - 点遮罩关闭（maskClosable=true）
    - 打开时锁定 body 滚动（lockScroll=true）
    - slot：默认内容 / #header / #footer
  -->
  <Teleport to="body">
    <Transition name="v-modal">
      <div
        v-if="modelValue"
        class="v-modal-mask"
        @click.self="onMaskClick"
      >
        <div class="v-modal-wrap" :style="wrapStyle" role="dialog" aria-modal="true">
          <header v-if="$slots.header || title" class="v-modal-header">
            <slot name="header">{{ title }}</slot>
          </header>
          <section class="v-modal-content">
            <slot />
          </section>
          <footer v-if="$slots.footer" class="v-modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 与 v-model 配对；也可用 show / hide 方法直接控制 */
    title?: string
    /** 弹窗宽度（px / 任意 CSS 长度） */
    width?: string | number
    /** 点击遮罩是否关闭 */
    maskClosable?: boolean
    /** Esc 是否关闭 */
    escClose?: boolean
    /** 打开时锁定 body 滚动 */
    lockScroll?: boolean
  }>(),
  {
    title: '',
    width: 480,
    maskClosable: true,
    escClose: true,
    lockScroll: true
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const wrapStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width
}))

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onMaskClick() {
  if (props.maskClosable) {
    close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return
  }
  if (event.key === 'Escape' && props.escClose) {
    event.stopPropagation()
    close()
  }
}

// ---------- body 滚动锁定 ----------
let prevOverflow = ''
let prevPaddingRight = ''

function lockBody() {
  if (!props.lockScroll || typeof document === 'undefined') {
    return
  }
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  prevOverflow = document.body.style.overflow
  prevPaddingRight = document.body.style.paddingRight
  document.body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }
}

function unlockBody() {
  if (!props.lockScroll || typeof document === 'undefined') {
    return
  }
  document.body.style.overflow = prevOverflow
  document.body.style.paddingRight = prevPaddingRight
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      lockBody()
      document.addEventListener('keydown', onKeydown)
    } else {
      unlockBody()
      document.removeEventListener('keydown', onKeydown)
    }
  }
)

onBeforeUnmount(() => {
  unlockBody()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.v-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  transition: opacity 0.3s ease;
}

.v-modal-wrap {
  min-width: 400px;
  max-width: calc(100vw - 32px);
  background-color: var(--surface-color);
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.v-modal-header {
  padding: 10px 15px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-color);
}

.v-modal-content {
  padding: 15px;
}

.v-modal-footer {
  padding: 12px 15px;
  text-align: center;
  border-top: 1px solid var(--border-color);
}

.v-modal-enter-from,
.v-modal-leave-to {
  opacity: 0;
}

.v-modal-enter-from .v-modal-wrap,
.v-modal-leave-to .v-modal-wrap {
  transform: scale(1.06);
}
</style>