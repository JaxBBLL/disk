const { ref, onMounted, nextTick } = Vue;

export default (cb) => {
  const isMenuVisible = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const menuItems = ref([]);
  const menuRef = ref(null);

  const handleMenuShow = (event, item) => {
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

  const handleMenuHide = () => {
    isMenuVisible.value = false;
  };

  const handleMenuItemClick = (item) => {
    cb && cb(item);
  };

  onMounted(() => {
    window.addEventListener("click", handleMenuHide);
  });

  return {
    isMenuVisible,
    menuItems,
    menuTop,
    menuLeft,
    menuRef,
    handleMenuShow,
    handleMenuHide,
    handleMenuItemClick,
  };
};
