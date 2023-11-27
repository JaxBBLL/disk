<template>
  <div @contextmenu="showMenu">
    <slot></slot>
    <Teleport to="body">
      <transition name="menu-fade" @after-leave="menuHide">
        <div
          class="menu"
          ref="menuRef"
          v-if="menuVisible"
          :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
        >
          <div
            class="menu-item"
            v-for="(item, index) in menu"
            :key="index"
            @click.stop="handleMenuItemClick($event, item)"
          >
            {{ item.label }}
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, onUnmounted, defineEmits } from 'vue'

const menuVisible = ref(false)
const menuPosition = reactive({ x: 0, y: 0 })
const menuRef = ref(null)
const emits = defineEmits(['action', 'contextmenu'])

defineProps({
  menu: {
    type: Array,
    default: () => []
  }
})

const showMenu = (e) => {
  emits('contextmenu', e)
  e.preventDefault()
  e.stopPropagation()
  menuVisible.value = true
  nextTick(() => {
    const contextMenu = menuRef.value
    const menuWidth = contextMenu.offsetWidth
    const menuHeight = contextMenu.offsetHeight

    const clickX = event.clientX
    const clickY = event.clientY

    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight

    if (screenWidth - clickX < menuWidth) {
      menuPosition.x = screenWidth - menuWidth
    } else {
      menuPosition.x = clickX
    }
    if (screenHeight - clickY < menuHeight) {
      menuPosition.y = screenHeight - menuHeight
    } else {
      menuPosition.y = clickY
    }
  })
}

const handleMenuItemClick = (event, item) => {
  menuVisible.value = false
  emits('action', event, item)
}

const menuHide = () => {
  menuVisible.value = false
}

onMounted(() => {
  window.addEventListener('click', menuHide, true)
  window.addEventListener('contextmenu', menuHide, true)
})

onUnmounted(() => {
  window.removeEventListener('click', menuHide)
  window.removeEventListener('contextmenu', menuHide)
})
</script>

<style scoped>
.menu {
  position: fixed;
  background-color: #fff;
  border: 1px solid var(--border-color);
  padding: 5px 0;
  z-index: 2147483647;
  box-shadow: 0 1px 6px 0px rgba(100, 100, 100, 0.6);
  border-radius: 4px;
}
.menu .menu-item {
  min-width: 60px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 14px;
}
.menu .menu-item:hover {
  background-color: #f2f2f2;
}
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.3s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}
</style>
