<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-mask">
        <div class="modal-wrap">
          <header class="modal-header">选择文件夹</header>
          <section class="modal-content">
            <div v-for="(items, index) in tree" :key="index" class="modal-list">
              <div
                v-for="cur in items"
                :key="cur.filePath"
                class="modal-item"
                :class="selectFolderPath === cur.filePath ? 'active' : ''"
                :title="cur.name"
                @click="selectFolder(cur, index)"
              >
                <svg
                  class="icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 512 512"
                  fill="#fee082"
                >
                  <path
                    d="M464 128H272l-64-64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V176c0-26.51-21.49-48-48-48z"
                  ></path>
                </svg>
                <div class="name">{{ cur.name }}</div>
              </div>
            </div>
          </section>
          <footer class="modal-footer">
            <span class="btn" @click="close">关闭</span>
            <span class="btn btn-primary" @click="submit">确定</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { FileItem, ListBody, ListResult } from '#shared/types'
// 显式导入：Nuxt 内置也有一个 reportError 组合式函数，避免自动导入解析到它
import { reportError } from '~/utils/error'

const props = withDefaults(defineProps<{ modelValue?: boolean }>(), {
  modelValue: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [filePath: string]
}>()

/** 目录树的每一层 */
const tree = ref<FileItem[][]>([])
const selectFolderPath = ref('')

const close = () => emit('update:modelValue', false)

const submit = () => {
  emit('submit', selectFolderPath.value)
  close()
}

async function loadChildren(item: { filePath: string }, index: number) {
  selectFolderPath.value = item.filePath

  try {
    const res = await $fetch<ListResult>('/api/list', {
      method: 'POST',
      body: {
        isDirectory: true,
        filePath: item.filePath.split('/').filter(Boolean)
      } satisfies ListBody
    })

    tree.value.splice(index + 1)

    if (res?.data?.length) {
      tree.value.push(res.data)
    }
  } catch (error) {
    reportError(error, '读取目录失败')
  }
}

const selectFolder = (item: FileItem, index: number) => {
  void loadChildren(item, index)
}

// 每次打开都重置为根目录，避免残留上次的层级
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return
    }
    tree.value = [[{ name: '根目录', filePath: '' } as FileItem]]
    selectFolderPath.value = ''
    void loadChildren({ filePath: '' }, 0)
  }
)
</script>
