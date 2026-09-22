/**
 * UI 库统一出口。
 *
 * 设计目标：
 * - app/ui/ 目录里的所有组件 / composables 都是「通用 UI 资产」，
 *   与本项目业务（文件管理器）无耦合。
 * - 业务代码（app/components/、app/composables/、app/pages/）
 *   通过自动导入或显式 import 使用。
 * - 未来独立成 npm 包时，把整个 ui/ 抽出去作为模块入口即可，
 *   消费者仅需 `import '@peer/ui'` 或安装 Nuxt module。
 *
 * 当前导出：
 * - 类型：VDropdownItem（其它组件 props 都是内部状态，无需导出）
 * - composables：useToast / useDialog（命令式 API）
 *
 * 组件 VModal / VDropdown / VToast 由 Nuxt 自动注册（见 nuxt.config.ts
 * 的 components / imports 配置），无需在此处 re-export。
 */

export type { VDropdownItem } from './components/VDropdown.vue'

export { useDialog } from './composables/useDialog'
export type { DialogKind, DialogState } from './composables/useDialog'

export { useToast, toast } from './composables/useToast'
export type { ToastType, ToastItem } from './composables/useToast'