<template>
  <ContextMenu :menu="menuItems" @action="menuAction" @before="handleBeforeShow()">
    <template v-slot="{ handle }">
      <div class="app" @contextmenu="handle">
        <header class="header">
          <div class="header-main">
            <div class="bread">
              <span
                v-for="(item, index) in paths"
                @click="gotoFolder(index, index === paths.length - 1)"
                class="bread-item"
                :key="index"
                >{{ item || '根目录' }}</span
              >
            </div>
            <span class="btn btn-primary" @click="handleUpload"> 上传文件 </span>
          </div>
        </header>
        <main class="main">
          <div class="main-main">
            <section v-if="!isLoading">
              <div class="list" v-if="list.length">
                <template v-for="(item, index) in list" :key="index">
                  <ContextMenu
                    :menu="menuItems"
                    @action="menuAction"
                    @before="handleBeforeShow(item)"
                  >
                    <template v-slot="{ handle }">
                      <div
                        class="list-item"
                        :draggable="true"
                        @dragstart="dragStart(item, $event)"
                        @dragover="dropOver(item, $event)"
                        @drop="drop(item, $event)"
                        @contextmenu="handle"
                        @click="handleSelectItem(item)"
                      >
                        <label class="checkbox child-checkbox" @click.stop>
                          <input type="checkbox" :value="item" v-model="selectedItems" />
                        </label>
                        <div
                          class="file-name"
                          @click.stop="
                            item.isDirectory ? entryDirectory(item) : handleDownload(item, true)
                          "
                        >
                          <span v-if="!item.isDirectory" class="icon" :class="item.icon"></span>
                          <svg
                            v-else
                            class="icon"
                            :class="item.icon"
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
                          <div>{{ item.name }}</div>
                        </div>
                        <div
                          v-if="!item.isDirectory"
                          style="margin: 0 20px; color: var(--gray-color)"
                        >
                          {{ item.size }} KB
                        </div>
                        <div style="color: var(--gray-color)">{{ item.birthtime }}</div>
                      </div>
                    </template>
                  </ContextMenu>
                </template>
              </div>
              <div class="list" v-else>
                <div style="text-align: center; padding: 10px">无文件</div>
              </div>
            </section>
            <div class="lds-roller" v-else>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </main>
        <footer class="footer">
          <div class="footer-main">
            <label class="checkbox">
              <input type="checkbox" v-model="selectAll" @change="toggleAll" />
              <span>全选</span>
            </label>
            <div style="margin-left: 20px" v-show="selectedItems.length">
              <span class="btn-text btn-danger" @click="handlePatchDelete"> 删除 </span>
              <!-- <span class="btn" @click="handleUpload"> 移动 </span> -->
            </div>
          </div>
        </footer>
        <dialog class="dialog-wrap" ref="dialog" :open="isOpen">
          <section class="dialog-content">
            <div class="dialog-list" v-for="(item, index) in treeList" :key="index">
              <div
                class="dialog-item"
                :class="selectFolderPath == cur.filePath ? 'active' : ''"
                v-for="cur in item"
                :key="cur"
                @click="dialogClick(cur, index)"
                :title="cur.name"
              >
                {{ cur.name }}
              </div>
            </div>
          </section>
          <footer class="dialog-footer">
            <span @click="dialogClose" class="btn" type="button">关闭</span>
            <span @click="dialogSubmit" class="btn btn-primary" type="button">确定</span>
          </footer>
        </dialog>
      </div>
    </template>
  </ContextMenu>
</template>

<script setup>
import * as FileIcons from 'file-icons-js'
import { ref } from 'vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { download, selectFiles, selectFolder } from '@/utils/index.js'
import useDrop from '@/hooks/useDrop.js'
import useSelectAll from '@/hooks/useSelectAll'

const hash = decodeURIComponent(location.hash.slice(1))
const list = ref([])
const isLoading = ref(false)
const paths = ref(hash.split('/'))

const { selectedItems, selectAll, toggleAll } = useSelectAll(list)

const isOpen = ref(false)
const treeList = ref([])
const dialog = ref(null)
const selectFolderPath = ref('')
const currentMoveItem = ref(null)

const { dragStart, drop, dropOver } = useDrop((origin, target) => {
  if (!target.isDirectory) {
    return
  }
  fetch('/api/rename', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      basePath: paths.value,
      oldPath: origin.name,
      newPath: target.name + '/' + origin.name
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.isExit) {
        alert(res.message)
      } else {
        getList()
      }
    })
})

const menuItems = ref([
  { label: '刷新', action: '-1' },
  { label: '上传文件', action: '4' },
  { label: '上传文件夹', action: '5' },
  { label: '新建文件夹', action: '6' }
])

const handleBeforeShow = (item) => {
  menuItems.value = []
  if (item) {
    menuItems.value = [
      ...(item.isDirectory
        ? [
            { label: '打开', action: '0', value: item },
            { label: '下载文件夹', action: '1', value: item }
          ]
        : [{ label: '下载', action: '1', value: item }]),
      { label: '重命名', action: '2', value: item },
      { label: '移动', action: '7', value: item },
      ...(item.hasDel ? [{ label: '删除', action: '3', value: item }] : [])
    ]
  } else {
    menuItems.value.push({ label: '刷新', action: '-1' })
  }
  menuItems.value.push(
    ...[
      { label: '上传文件', action: '4' },
      { label: '上传文件夹', action: '5' },
      { label: '新建文件夹', action: '6' }
    ]
  )
}
const menuAction = (event, item) => {
  const map = {
    '-1': () => {
      getList()
    },
    0: () => {
      entryDirectory(item.value)
    },
    1: () => {
      handleDownload(item.value)
    },
    2: () => {
      setTimeout(() => {
        handleRename(item.value)
      }, 100)
    },
    3: () => {
      setTimeout(() => {
        handleDelete([item.value.filePath])
      }, 100)
    },
    4: () => {
      handleUpload()
    },
    5: () => {
      handleUploadFolder()
    },
    6: () => {
      setTimeout(() => {
        createFolder()
      }, 100)
    },
    7: () => {
      currentMoveItem.value = item.value
      const rootItem = {
        name: '根目录',
        filePath: ''
      }
      treeList.value = [[rootItem]]
      selectFolderPath.value = ''
      dialogShow()
      dialogClick(rootItem, 0)
    }
  }
  map[item.action]()
}

const dialogClick = (item, index) => {
  selectFolderPath.value = item.filePath
  fetch(`/api/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      isDirectory: true,
      filePath: item.filePath.split('/')
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.code === 200) {
        treeList.value.splice(index + 1)
        if (res.data.length) {
          treeList.value.push(res.data)
        }
      }
    })
    .finally(() => {})
}

const getBasePath = (string) => {
  const lastIndex = string.lastIndexOf('/')
  if (lastIndex === -1) {
    return []
  }
  const result = string.substring(0, lastIndex)
  return result.split('/')
}

const handleRename = (item) => {
  const lastIndex = item.name.lastIndexOf('.')
  const ext = lastIndex === -1 ? '' : item.name.slice(lastIndex)
  const name = lastIndex === -1 ? item.name : item.name.slice(0, lastIndex)
  const input = window.prompt('新名称', name)
  const text = (input || '').trim()
  if (!text) {
    return
  }
  // 校验文件名格式
  const illegalCharacters = /[<>:"/\\|?*]/g // 不允许出现非法字符
  if (illegalCharacters.test(text)) {
    alert('文件名包含非法字符')
    return
  }

  fetch('/api/rename', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      basePath: paths.value,
      oldPath: item.name,
      newPath: text + ext
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.isExit) {
        alert(res.message)
      } else {
        getList()
      }
    })
}

const handleUploadFolder = () => {
  selectFolder(async (files) => {
    for (const file of files) {
      const formData = new FormData()
      formData.append('files', file)
      const basePath = getBasePath(file.webkitRelativePath)
      const pathArray = paths.value.concat(basePath)
      isLoading.value = true
      await fetch(`/api/uploads?filePath=${pathArray.join(',')}`, {
        method: 'POST',
        body: formData,
        headers: {}
      }).catch(() => {
        isLoading.value = false
      })
    }
    getList()
  })
}

const handleUpload = () => {
  selectFiles((files) => {
    const formData = new FormData()
    ;[...files].forEach((file) => {
      formData.append('files', file)
      formData.append('path', 1)
    })
    isLoading.value = true
    fetch(`/api/uploads?filePath=${paths.value.join(',')}`, {
      method: 'POST',
      body: formData,
      headers: {}
    })
      .then((res) => {
        if (res.status === 200) {
          getList()
        }
      })
      .finally(() => {
        isLoading.value = false
      })
  })
}

const handleSelectItem = (item) => {
  const isIn = selectedItems.value.some((s) => s.name === item.name)
  if (isIn) {
    selectedItems.value = selectedItems.value.filter((s) => s.name !== item.name)
  } else {
    selectedItems.value.push(item)
  }
}

const getList = () => {
  isLoading.value = true
  selectAll.value = false
  selectedItems.value = []
  fetch(`/api/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filePath: paths.value
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.code === 200) {
        list.value = res.data.map((item) => {
          item.icon = FileIcons.getClassWithColor(item.name)
          return item
        })
      }
    })
    .finally(() => {
      isLoading.value = false
    })
}

const entryDirectory = (item) => {
  paths.value.push(item.name)
  location.hash = paths.value.join('/')
  getList()
}

const gotoFolder = (index, isLast) => {
  if (isLast) return
  paths.value.splice(index + 1)
  location.hash = paths.value.join('/')
  getList()
}

const handleDownload = (item, isPreviewFist = false) => {
  if (isPreviewFist) {
    window.open(`/api/preview/${item.name}?filePath=${item.filePath}`)
  } else {
    download(`/api/${item.isDirectory ? 'downloadFolder' : 'download'}?filePath=${item.filePath}`)
  }
}

const createFolder = () => {
  const input = window.prompt('新建文件夹名称')
  const text = (input || '').trim()
  if (!text) {
    return
  }
  fetch('/api/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filePath: paths.value,
      name: text
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.isExit) {
        window.alert('文件夹已存在')
      } else {
        getList()
      }
    })
}

const handleDelete = (filePaths) => {
  const result = confirm(`确定删除：${[filePaths]}?`)
  if (result) {
    fetch(`/api/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filePaths
      })
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.code === 200) {
          getList()
        }
      })
  }
}

const handlePatchDelete = () => {
  const filePaths = selectedItems.value.map((item) => item.filePath)
  handleDelete(filePaths)
}

const dialogClose = () => {
  dialog.value.close()
}

const dialogShow = () => {
  dialog.value.showModal()
}

const dialogSubmit = () => {
  fetch('/api/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      oldPath: currentMoveItem.value.filePath,
      newPath: [selectFolderPath.value, currentMoveItem.value.name]
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.isExit) {
        alert(res.message)
      } else {
        dialogClose()
        getList()
      }
    })
}

getList()
</script>
<style scoped></style>
