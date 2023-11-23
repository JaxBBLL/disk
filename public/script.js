import { download, selectFiles, selectFolder } from "./util.js";
const { createApp, ref, onMounted, nextTick } = Vue;

const setup = function () {
  const hash = decodeURIComponent(location.hash.slice(1));

  const list = ref([]);
  const isLoading = ref(false);
  const paths = ref(hash.split("/"));
  const isMenuVisible = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const menuItems = ref([
    { text: "上传文件", action: "1" },
    { text: "新建文件夹", action: "2" },
  ]);
  const menuRef = ref(null);

  const showMenu = (event, item) => {
    if (item) {
      menuItems.value = [
        { text: item.isDirectory ? "进入" : "下载", action: "3", value: item },
        ...(item.hasDel ? [{ text: "删除", action: "4", value: item }] : []),
      ];
    } else {
      menuItems.value = [
        { text: "上传文件", action: "0" },
        { text: "上传文件夹", action: "1" },
        { text: "新建文件夹", action: "2" },
      ];
    }
    isMenuVisible.value = true;
    nextTick(() => {
      const contextMenu = menuRef.value;
      const menuWidth = contextMenu.offsetWidth;
      const menuHeight = contextMenu.offsetHeight;

      const clickX = event.clientX;
      const clickY = event.clientY;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      if (screenWidth - clickX < menuWidth) {
        menuLeft.value = screenWidth - menuWidth;
      } else {
        menuLeft.value = clickX;
      }
      if (screenHeight - clickY < menuHeight) {
        menuTop.value = screenHeight - menuHeight;
      } else {
        menuTop.value = clickY;
      }
    });
  };

  const hideMenu = () => {
    isMenuVisible.value = false;
  };

  const getBasePath = (string) => {
    const lastIndex = string.lastIndexOf("/");
    if (lastIndex === -1) {
      return [];
    }
    const result = string.substring(0, lastIndex);
    return result.split("/");
  };
  const handleMenuItemClick = (item) => {
    if (item.action === "0") {
      handleUpload();
    } else if (item.action === "1") {
      selectFolder(async (files) => {
        for (const file of files) {
          const formData = new FormData();
          formData.append("files", file);
          const basePath = getBasePath(file.webkitRelativePath);
          const pathArray = paths.value.concat(basePath);
          isLoading.value = true;
          await fetch(`/uploads?filePath=${pathArray.join(",")}`, {
            method: "POST",
            body: formData,
            headers: {},
          }).catch(() => {
            isLoading.value = false;
          });
        }
        getList();
      });
    } else if (item.action === "2") {
      createFolder();
    } else if (item.action === "3") {
      itemClick(item.value);
    } else if (item.action === "4") {
      handleDelete(item.value.filePath);
    }
  };

  const handleUpload = () => {
    selectFiles((files) => {
      const formData = new FormData();
      [...files].forEach((file) => {
        formData.append("files", file);
        formData.append("path", 1);
      });
      isLoading.value = true;
      fetch(`/uploads?filePath=${paths.value.join(",")}`, {
        method: "POST",
        body: formData,
        headers: {},
      })
        .then((res) => {
          if (res.status === 200) {
            getList();
          }
        })
        .finally(() => {
          isLoading.value = false;
        });
    });
  };

  const getList = () => {
    isLoading.value = true;
    fetch(`/list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath: paths.value,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.code === 200) {
          list.value = res.data.map((item) => {
            item.icon = window.FileIcons.getClassWithColor(item.name);
            return item;
          });
        }
      })
      .finally(() => {
        isLoading.value = false;
      });
  };

  const entryDirectory = (item) => {
    paths.value.push(item.name);
    location.hash = paths.value.join("/");
    getList();
  };

  const gotoFolder = (index, isLast) => {
    if (isLast) return;
    paths.value.splice(index + 1);
    location.hash = paths.value.join("/");
    getList();
  };

  const itemClick = (item) => {
    if (item.isDirectory) {
      entryDirectory(item);
    } else {
      const path = `/download?filePath=${item.filePath}`;
      download(path);
    }
  };

  const createFolder = () => {
    const input = window.prompt("新建文件夹名称");
    const text = (input || "").trim();
    if (!text) {
      return;
    }
    fetch("/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath: paths.value,
        name: text,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.isExit) {
          window.alert("文件夹已存在");
        } else {
          getList();
        }
      });
  };

  const handleDelete = (filePath) => {
    const result = confirm(`确定删除：${filePath}?`);
    if (result) {
      fetch(`/delete?filePath=${filePath}`)
        .then((res) => res.json())
        .then((res) => {
          if (res.code === 200) {
            getList();
          }
        });
    }
  };

  onMounted(() => {
    window.addEventListener("click", hideMenu);
  });

  getList();

  return {
    list,
    isLoading,
    paths,
    handleUpload,
    entryDirectory,
    gotoFolder,
    itemClick,
    createFolder,
    isMenuVisible,
    showMenu,
    menuItems,
    menuTop,
    menuLeft,
    handleMenuItemClick,
    menuRef,
  };
};

const app = createApp({
  setup,
});
app.mount("#app");
