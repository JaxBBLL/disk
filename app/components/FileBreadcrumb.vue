<template>
  <div class="bread">
    <span
      v-for="item in items"
      :key="item.depth"
      class="bread-item"
      @click="onClick(item.depth)"
    >
      {{ item.name }}
    </span>
  </div>
</template>

<script setup lang="ts">
interface BreadItem {
  depth: number
  name: string
}

const props = withDefaults(defineProps<{ paths?: string[] }>(), {
  paths: () => []
})

const emit = defineEmits<{
  navigate: [depth: number]
}>()

// 「根目录」固定为第一级，后续为逐级目录名
const items = computed<BreadItem[]>(() => [
  { depth: 0, name: '根目录' },
  ...props.paths.map((name, index) => ({ depth: index + 1, name }))
])

// 点击当前所在层级不触发导航
const onClick = (depth: number) => {
  if (depth !== props.paths.length) {
    emit('navigate', depth)
  }
}
</script>
