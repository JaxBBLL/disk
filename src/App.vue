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
            <input class="input" type="text" placeholder="搜索" v-model="fileName" />
            <span class="btn btn-primary" @click="handleUpload"> 上传文件 </span>
          </div>
        </header>
        <main class="main">
          <div class="main-main" v-if="!isLoading">
            <table class="table" v-if="list.length">
              <thead>
                <tr>
                  <th width="30">
                    <label class="checkbox">
                      <input
                        type="checkbox"
                        v-model="selectAll"
                        @change="toggleAll"
                        :indeterminate="indeterminate"
                      />
                      <!-- <span>全选</span> -->
                    </label>
                  </th>
                  <th>
                    <div class="flex" v-if="selectedItems.length">
                      <span class="btn-text" @click="downloadZip"> 下载 </span>
                      <span class="btn-text" @click="dialogShow()"> 移动 </span>
                      <span v-if="hasDel" class="btn-text btn-danger" @click="handlePatchDelete">
                        删除
                      </span>
                    </div>
                    <div v-else>名称</div>
                  </th>
                  <th width="140">大小</th>
                  <th width="120">修改时间</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(item, index) in list" :key="index">
                  <ContextMenu
                    :menu="menuItems"
                    @action="menuAction"
                    @before="handleBeforeShow(item)"
                  >
                    <template v-slot="{ handle }">
                      <tr
                        :draggable="true"
                        @dragstart="dragStart(item, $event)"
                        @dragover="dropOver(item, $event)"
                        @drop="drop(item, $event)"
                        @contextmenu="handle"
                        @click="handleSelectItem(item)"
                      >
                        <td>
                          <label class="checkbox child-checkbox" @click.stop>
                            <input type="checkbox" :value="item" v-model="selectedItems" />
                          </label>
                        </td>
                        <td>
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
                        </td>
                        <td>
                          <div v-if="!item.isDirectory">{{ item.size }} KB</div>
                        </td>
                        <td>{{ item.updatetime }}</td>
                      </tr>
                    </template>
                  </ContextMenu>
                </template>
              </tbody>
            </table>
            <div v-else class="no-table">无文件</div>
          </div>
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
        </main>
        <Teleport to="body">
          <Transition name="modal">
            <div v-if="isOpen" class="modal-mask">
              <div class="modal-wrap">
                <header class="modal-header">选择文件夹</header>
                <section class="modal-content">
                  <div class="modal-list" v-for="(item, index) in treeList" :key="index">
                    <div
                      class="modal-item"
                      :class="selectFolderPath == cur.filePath ? 'active' : ''"
                      v-for="cur in item"
                      :key="cur"
                      @click="dialogClick(cur, index)"
                      :title="cur.name"
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
                      <div class="name">
                        {{ cur.name }}
                      </div>
                    </div>
                  </div>
                </section>
                <footer class="modal-footer">
                  <span @click="dialogClose" class="btn" type="button">关闭</span>
                  <span @click="dialogSubmit" class="btn btn-primary" type="button">确定</span>
                </footer>
              </div>
            </div>
          </Transition>
        </Teleport>
      </div>
    </template>
  </ContextMenu>
</template>

<script setup>
import * as FileIcons from 'file-icons-js'
import { ref, watch } from 'vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { download, selectFiles, selectFolder } from '@/utils/index.js'
import useDrop from '@/hooks/useDrop.js'
import useSelectAll from '@/hooks/useSelectAll'
import { debounceRef } from './utils/debounceRef'

const hasDel = ref(false)
const hash = decodeURIComponent(location.hash.slice(1))
const list = ref([])
const fileName = debounceRef('')
const isLoading = ref(false)
const paths = ref(hash.split('/'))

const { selectedItems, selectAll, toggleAll, indeterminate } = useSelectAll(list)

const isOpen = ref(false)
const treeList = ref([])
const selectFolderPath = ref('')
const currentMoveItem = ref([])

const { dragStart, drop, dropOver } = useDrop((origin, target) => {
  if (!target.isDirectory) {
    return
  }
  const filePaths = [origin.filePath]
  console.log(origin, target)
  fetch('/api/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filePaths,
      newFolder: target.filePath
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.code == 200) {
        const isExit = res.data.some((i) => i.isExit)
        if (isExit) {
          alert('目录存在相同文件名')
        }
        dialogClose()
        getList()
      } else {
        alert(res.message)
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
      dialogShow(item.value)
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
      filePath: item.filePath,
      newName: text + ext
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

watch(fileName, () => getList())

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
      name: fileName.value,
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
        hasDel.value = res.hasDel
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
    window.open(`/api/download/preview/${item.name}?filePath=${item.filePath}`)
  } else {
    download(`/api/download?filePaths=${JSON.stringify([item.filePath])}`)
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
        } else {
          alert(res.message)
        }
      })
  }
}

const handlePatchDelete = () => {
  const filePaths = selectedItems.value.map((item) => item.filePath)
  handleDelete(filePaths)
}

const dialogClose = () => {
  isOpen.value = false
}

const dialogShow = (item) => {
  if (item) {
    currentMoveItem.value = [item]
  } else {
    currentMoveItem.value = [...selectedItems.value]
  }
  isOpen.value = true
  const rootItem = {
    name: '根目录',
    filePath: ''
  }
  treeList.value = [[rootItem]]
  selectFolderPath.value = ''
  dialogClick(rootItem, 0)
}

const dialogSubmit = () => {
  const filePaths = currentMoveItem.value.map((item) => item.filePath)

  fetch('/api/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filePaths,
      newFolder: selectFolderPath.value
    })
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.code == 200) {
        const isExit = res.data.some((i) => i.isExit)
        if (isExit) {
          alert('目录存在相同文件名')
        }
        dialogClose()
        getList()
      } else {
        alert(res.message)
      }
    })
}

const downloadZip = () => {
  const filePaths = selectedItems.value.map((item) => item.filePath)
  download(`/api/download?filePaths=${JSON.stringify(filePaths)}`)
}

getList()
</script>
<style scoped lang="less"></style>
