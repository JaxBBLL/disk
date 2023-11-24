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
  const menuItems = ref([]);
  const menuRef = ref(null);

  const showMenu = (event, item) => {
    menuItems.value = [];
    if (item) {
      menuItems.value = [
        ...(item.isDirectory
          ? [
              { text: "进入", action: "0", value: item },
              { text: "下载文件夹", action: "1", value: item },
            ]
          : [{ text: "下载", action: "1", value: item }]),
        { text: "重命名", action: "2", value: item },
        ...(item.hasDel ? [{ text: "删除", action: "3", value: item }] : []),
      ];
    } else {
      menuItems.value.push({ text: "刷新", action: "-1" });
    }
    menuItems.value.push(
      ...[
        { text: "上传文件", action: "4" },
        { text: "上传文件夹", action: "5" },
        { text: "新建文件夹", action: "6" },
      ]
    );
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
    const map = {
      "-1": () => {
        getList();
      },
      0: () => {
        entryDirectory(item);
      },
      1: () => {
        handleDownload(item.value);
      },
      2: () => {
        hideMenu();
        setTimeout(() => {
          handleRename(item.value);
        }, 100);
      },
      3: () => {
        handleDelete(item.value.filePath);
      },
      4: () => {
        handleUpload();
      },
      5: () => {
        handleUploadFolder();
      },
      6: () => {
        hideMenu();
        setTimeout(() => {
          createFolder();
        }, 100);
      },
    };
    map[item.action]();
  };

  const handleRename = (item) => {
    const input = window.prompt("新名称");
    const text = (input || "").trim();
    if (!text) {
      return;
    }
    // 校验文件名格式
    const illegalCharacters = /[<>:"/\\|?*]/g; // 不允许出现非法字符
    if (illegalCharacters.test(text)) {
      alert("文件名包含非法字符");
      return;
    }
    const lastIndex = item.name.lastIndexOf(".");
    const ext = lastIndex === -1 ? "" : item.name.slice(lastIndex);
    fetch("/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filePath: paths.value,
        oldName: item.name,
        name: text + ext,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        getList();
      });
  };

  const handleUploadFolder = () => {
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

  const handleDownload = (item) => {
    download(
      `/${item.isDirectory ? "downloadFolder" : "download"}?filePath=${
        item.filePath
      }`
    );
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
    handleDownload,
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
