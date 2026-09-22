<template>
  <VModal v-model="state.open" :title="state.title" :width="360">
    <p class="dialog-message">{{ state.message }}</p>
    <input
      v-if="state.kind === 'prompt'"
      v-model="state.value"
      class="input dialog-input"
      autofocus
      @keyup.enter="submit"
    />

    <template #footer>
      <span class="btn" @click="cancel">取消</span>
      <span class="btn btn-primary" @click="submit">确定</span>
    </template>
  </VModal>
</template>

<script setup lang="ts">
import { useDialog } from '~/ui/composables/useDialog'

const { state, submit, cancel } = useDialog()

/**
 * 双向同步 useDialog 与 VModal 的开关：
 * - state.open 由命令式 confirm/prompt 控制，VModal 通过 v-model 同步显示
 * - 用户点 VModal 遮罩 / Esc 时也会触发 state.open = false，自动 resolve(false/null)
 */
</script>

<style scoped>
.dialog-message {
  margin: 0;
  color: var(--text-color);
  word-break: break-all;
}

.dialog-input {
  width: 100%;
  margin-top: 8px;
}
</style>