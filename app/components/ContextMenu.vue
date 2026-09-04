<template>
  <slot :handle="showMenu" />
  <Teleport to="body">
    <transition name="menu-fade" @after-leave="menuHide">
      <div
        v-show="menuVisible"
        ref="menuRef"
        class="menu"
        :style="{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }"
      >
        <div
          v-for="(item, index) in menu"
          :key="index"
          class="menu-item"
          @click.stop="handleMenuItemClick($event, item)"
        >
          {{ item.label }}
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { MenuItem } from '#shared/types'

const props = withDefaults(defineProps<{ menu?: MenuItem[] }>(), {
  menu: () => []
})

const emit = defineEmits<{
  action: [event: MouseEvent, item: MenuItem]
  before: [event: MouseEvent]
}>()

const menuVisible = ref(false)
const menuPosition = reactive({ x: 0, y: 0 })
const menuRef = ref<HTMLElement | null>(null)

const showMenu = (event: MouseEvent) => {
  emit('before', event)
  event.preventDefault()
  event.stopPropagation()

  // 提前取出坐标，避免在 nextTick 中依赖 window.event（原实现的隐患）
  const clickX = event.clientX
  const clickY = event.clientY

  menuVisible.value = true

  nextTick(() => {
    const el = menuRef.value
    if (!el) {
      return
    }

    const menuWidth = el.offsetWidth
    const menuHeight = el.offsetHeight

    menuPosition.x =
      window.innerWidth - clickX < menuWidth ? window.innerWidth - menuWidth : clickX
    menuPosition.y =
      window.innerHeight - clickY < menuHeight ? window.innerHeight - menuHeight : clickY
  })
}

const handleMenuItemClick = (event: MouseEvent, item: MenuItem) => {
  menuVisible.value = false
  emit('action', event, item)
}

const menuHide = () => {
  menuVisible.value = false
}

onMounted(() => {
  window.addEventListener('click', menuHide, true)
  window.addEventListener('contextmenu', menuHide, true)
})

onUnmounted(() => {
  window.removeEventListener('click', menuHide, true)
  window.removeEventListener('contextmenu', menuHide, true)
})
</script>

<style scoped>
.menu {
  position: fixed;
  background-color: var(--surface-color);
  padding: 5px 0;
  z-index: 2147483647;
  box-shadow: 0 1px 6px 0px rgba(100, 100, 100, 0.6);
  border-radius: 4px;
}

.menu .menu-item {
  min-width: 60px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 14px;
}

.menu .menu-item:hover {
  color: #fff;
  background-color: var(--primary-color);
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
