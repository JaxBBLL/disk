const { createApp, ref, onMounted, nextTick } = Vue;

function download(filePath) {
  const a = document.createElement("a");
  a.download;
  a.href = filePath;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const setup = function () {
  const hash = location.hash.slice(1);

  const list = ref([]);
  const isSingle = ref(false);
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

  if (navigator.userAgent.indexOf("Weixin") > -1) {
    isSingle.value = true;
  }

  const showMenu = (event, item) => {
    if (item) {
      menuItems.value = [
        { text: item.isDirectory ? "进入" : "下载", action: "3", value: item },
        ...(item.hasDel ? [{ text: "删除", action: "4", value: item }] : []),
      ];
    } else {
      menuItems.value = [
        { text: "上传文件", action: "1" },
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

  const selectFiles = (cb) => {
    const input = document.createElement("input");
    input.type = "file";
    if (!isSingle.value) {
      input.multiple = "multiple";
    }
    input.click();
    input.addEventListener("change", (e) => {
      const files = e.target.files;
      if (!files.length) {
        return;
      }
      const formData = new FormData();
      [...files].forEach((file) => {
        formData.append("files", file);
      });
      cb && cb(formData);
    });
  };

  const hideMenu = () => {
    isMenuVisible.value = false;
  };
  const handleMenuItemClick = (item) => {
    if (item.action === "1") {
      handleUpload();
    } else if (item.action === "2") {
      createFolder();
    } else if (item.action === "3") {
      itemClick(item.value);
    } else if (item.action === "4") {
      handleDelete(item.value.filePath);
    }
  };

  const handleUpload = () => {
    selectFiles((formData) => {
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
    isSingle,
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
