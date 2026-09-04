<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="state.open" class="modal-mask">
        <div class="modal-wrap dialog">
          <header class="modal-header">{{ state.title }}</header>
          <section class="modal-content dialog-content">
            <p class="dialog-message">{{ state.message }}</p>
            <input
              v-if="state.kind === 'prompt'"
              v-model="state.value"
              class="input dialog-input"
              autofocus
              @keyup.enter="submit"
            />
          </section>
          <footer class="modal-footer">
            <span class="btn" @click="cancel">取消</span>
            <span class="btn btn-primary" @click="submit">确定</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useDialog } from '~/composables/useDialog'

const { state, submit, cancel } = useDialog()
</script>

<style scoped>
.dialog {
  max-width: 360px;
}

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
