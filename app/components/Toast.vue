<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast-${item.type}`">
        <span class="toast-icon" aria-hidden="true">{{ ICONS[item.type] }}</span>
        <span class="toast-message">{{ item.message }}</span>
        <button class="toast-close" aria-label="关闭" @click="dismiss(item.id)">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'
import type { ToastType } from '~/composables/useToast'

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' }
const { toasts, dismiss } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 52px;
  right: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  max-width: 360px;
  padding: 10px 12px;
  background: var(--surface-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 13px;
}

.toast-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
}

.toast-success .toast-icon {
  background: var(--primary-color);
}

.toast-error .toast-icon {
  background: var(--danger-color);
}

.toast-info .toast-icon {
  background: var(--gray-color);
}

.toast-message {
  flex: 1;
  color: var(--text-color);
}

.toast-close {
  border: 0;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
