const { createApp, ref } = Vue;

function download(filePath) {
  const a = document.createElement("a");
  a.download;
  a.href = filePath;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const setup = function () {
  const list = ref([]);
  const isSingle = ref(false);
  const isLoading = ref(false);
  const paths = ref([""]);

  if (navigator.userAgent.indexOf("Weixin") > -1) {
    isSingle.value = true;
  }

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

  const inputChange = (e) => {
    const files = e.target.files;
    if (!files.length) {
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    [...files].forEach((file) => {
      formData.append("files", file);
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
    e.target.value = "";
  };

  const entryDirectory = (item) => {
    paths.value.push(item.name);
    getList();
  };

  const gotoFolder = (index, isLast) => {
    if (isLast) return;
    paths.value.splice(index + 1);
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

  const deleteHandle = (filePath) => {
    const result = confirm(`确定删除${filePath}?`);
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

  getList();

  return {
    list,
    isSingle,
    isLoading,
    paths,
    inputChange,
    deleteHandle,
    entryDirectory,
    gotoFolder,
    itemClick,
    createFolder,
  };
};

const app = createApp({
  setup,
});
app.mount("#app");
