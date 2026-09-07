import type { Theme } from "#shared/types";

/** 应用启动前根据本地存储设置主题，避免首屏闪烁 */
export default defineNuxtPlugin(() => {
  const saved = localStorage.getItem("disk-theme");
  const initial: Theme =
    saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  applyTheme(initial);

  // 系统主题变化时，若用户选择「跟随系统」则同步切换
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const cur = localStorage.getItem("disk-theme");
      if (cur === "system") applyTheme("system");
    });
});

function applyTheme(theme: Theme) {
  const effective: "light" | "dark" =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.setAttribute("data-theme", effective);
}
