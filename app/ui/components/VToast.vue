<template>
  <Teleport to="body">
    <TransitionGroup name="v-toast" tag="div" class="v-toast-container">
      <div v-for="item in toasts" :key="item.id" class="v-toast" :class="`v-toast-${item.type}`">
        <span class="v-toast-icon" aria-hidden="true">{{ ICONS[item.type] }}</span>
        <span class="v-toast-message">{{ item.message }}</span>
        <button class="v-toast-close" aria-label="关闭" @click="dismiss(item.id)">×</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '~/ui/composables/useToast'
import type { ToastType } from '~/ui/composables/useToast'

const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' }
const { toasts, dismiss } = useToast()
</script>

<style scoped>
.v-toast-container {
  position: fixed;
  top: 52px;
  right: 16px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.v-toast {
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

.v-toast-icon {
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

.v-toast-success .v-toast-icon {
  background: var(--primary-color);
}

.v-toast-error .v-toast-icon {
  background: var(--danger-color);
}

.v-toast-info .v-toast-icon {
  background: var(--gray-color);
}

.v-toast-message {
  flex: 1;
  color: var(--text-color);
}

.v-toast-close {
  border: 0;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}

.v-toast-enter-active,
.v-toast-leave-active {
  transition: all 0.2s ease;
}

.v-toast-enter-from,
.v-toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
