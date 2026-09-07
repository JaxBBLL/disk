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
                <img class="icon" :src="folderIcon(cur.name)" alt="" width="14" height="14" />
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
import { folderIcon } from '~/utils/fileIcon'

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
