<template>
  <ContextMenu
    :menu="menuItems"
    @action="menuAction"
    @before="handleBeforeShow()"
  >
    <template #default="{ handle }">
      <!-- 拖拽区覆盖整页，拖到任意位置都能上传 -->
      <DropZone :target="dropTarget" @drop-files="uploadDropped">
        <div class="app" @contextmenu="handle">
          <header class="header">
            <div class="header-main">
              <FileBreadcrumb :paths="paths" @navigate="gotoBreadcrumb" />
              <input
                v-model="keyword"
                class="input"
                type="text"
                placeholder="搜索"
              />
              <div
                class="upload-dropdown"
                @mouseenter="uploadOpen = true"
                @mouseleave="uploadOpen = false"
              >
                <span class="btn">上传<span class="caret">▾</span></span>
                <Transition name="dropdown-fade">
                  <div v-if="uploadOpen" class="upload-menu">
                    <div class="menu-item" @click="pickAndUploadFiles">
                      上传文件
                    </div>
                    <div class="menu-item" @click="pickAndUploadFolder">
                      上传文件夹
                    </div>
                  </div>
                </Transition>
              </div>
              <span
                class="btn theme-toggle"
                :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
                @click="toggleTheme"
              >
                <svg
                  v-if="theme !== 'dark'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  ></path>
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              </span>
            </div>
          </header>

          <main class="main">
            <!-- 提示文案以水印形式铺满整个页面 -->
            <div class="upload-watermark" aria-hidden="true">
              <span v-for="i in 48" :key="i">支持拖拽上传</span>
            </div>

            <FileTable
              v-model:selected="selected"
              :list="list"
              :loading="loading"
              :menu="menuItems"
              @open="(item) => entryDirectory(item.name)"
              @preview="previewItem"
              @upload="pickAndUploadFiles"
              @drop-move="handleDropMove"
              @context-before="handleBeforeShow"
              @context-action="handleRowAction"
            />
          </main>

          <MoveDialog v-model="moveOpen" @submit="submitMove" />
        </div>
      </DropZone>

      <!-- 底部批量操作栏 -->
      <Transition name="batch">
        <div v-if="selected.length" class="batch-bar">
          <span class="batch-count">已选 {{ selected.length }} 项</span>
          <span class="btn-text" @click="downloadItems(selected)">下载</span>
          <span class="btn-text" @click="openMove(selected)">移动</span>
          <span
            v-if="hasDel"
            class="btn-text btn-danger"
            @click="removeItems(selected)"
            >删除</span
          >
          <span class="btn-text batch-clear" @click="selected = []"
            >取消选择</span
          >
        </div>
      </Transition>

      <!-- 上传进度提示 -->
      <Transition name="toast">
        <div v-if="uploading" class="upload-progress">
          <span class="spinner" aria-hidden="true"></span>
          <span>{{ uploadingLabel }}</span>
        </div>
      </Transition>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import type { FileItem, MenuItem, Theme } from "#shared/types";

const {
  list,
  loading,
  hasDel,
  paths,
  keyword,
  refresh,
  navigate,
  entryDirectory,
} = useFileList();

const {
  uploading,
  uploadingLabel,
  pickAndUploadFiles,
  pickAndUploadFolder,
  uploadDropped,
  downloadItems,
  previewItem,
  renameItem,
  createFolder,
  removeItems,
  moveItems,
} = useFileAction({ paths, refresh, loading });

const selected = ref<FileItem[]>([]);
const moveOpen = ref(false);
const moveTargets = ref<FileItem[]>([]);

const dropTarget = computed(() =>
  paths.value.length ? paths.value.join("/") : "根目录",
);

// 切换目录时清空选择，避免残留上一目录的选中项
watch(paths, () => {
  selected.value = [];
});

// ---------- 上传下拉与主题 ----------
const uploadOpen = ref(false);
const theme = ref<Theme>("light");

onMounted(() => {
  theme.value =
    (document.documentElement.getAttribute("data-theme") as Theme) || "light";
});

const toggleTheme = () => {
  const next: Theme = theme.value === "dark" ? "light" : "dark";
  theme.value = next;
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("disk-theme", next);
};

// ---------- 右键菜单 ----------
const menuItems = ref<MenuItem[]>([]);

const COMMON_MENU: MenuItem[] = [
  { label: "上传文件", action: "4" },
  { label: "上传文件夹", action: "5" },
  { label: "新建文件夹", action: "6" },
];

function buildMenu(item?: FileItem): MenuItem[] {
  if (!item) {
    return [{ label: "刷新", action: "-1" }, ...COMMON_MENU];
  }

  const head: MenuItem[] = item.isDirectory
    ? [
        { label: "打开", action: "0" },
        { label: "下载文件夹", action: "1" },
      ]
    : [{ label: "下载", action: "1" }];

  const tail: MenuItem[] = [
    { label: "重命名", action: "2" },
    { label: "移动", action: "7" },
  ];

  const del: MenuItem[] = hasDel.value ? [{ label: "删除", action: "3" }] : [];

  return [...head, ...tail, ...del, ...COMMON_MENU];
}

const handleBeforeShow = (item?: FileItem) => {
  menuItems.value = buildMenu(item);
};

const menuAction = (event: MouseEvent, item: MenuItem) =>
  handleRowAction(null, item);

function handleRowAction(item: FileItem | null, action: MenuItem) {
  const map: Record<string, () => void> = {
    "-1": () => void refresh(),
    "0": () => item && entryDirectory(item.name),
    "1": () => item && downloadItems([item]),
    "2": () => item && nextTick(() => void renameItem(item)),
    "3": () => item && nextTick(() => void removeItems([item])),
    "4": () => pickAndUploadFiles(),
    "5": () => pickAndUploadFolder(),
    "6": () => nextTick(() => void createFolder()),
    "7": () => item && nextTick(() => openMove([item])),
  };

  map[action?.action]?.();
}

// ---------- 面包屑 ----------
const gotoBreadcrumb = (depth: number) =>
  navigate(depth === 0 ? [] : paths.value.slice(0, depth));

// ---------- 移动 ----------
function openMove(items: FileItem[]) {
  if (!items.length) {
    return;
  }
  moveTargets.value = [...items];
  moveOpen.value = true;
}

async function submitMove(target: string) {
  await moveItems(moveTargets.value, target);
}

function handleDropMove(origin: FileItem, target: FileItem) {
  if (!origin || !target?.isDirectory) {
    return;
  }
  void moveItems([origin], target.filePath);
}
</script>
