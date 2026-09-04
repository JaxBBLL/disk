/**
 * 前后端共用的数据契约。
 *
 * 放在 shared/ 下，Nuxt 4 会同时注入 app 与 server 的自动导入，
 * 服务端产出与前端消费共用同一份类型，避免字段漂移。
 */

/** 列表项：由 server/api/list.post.ts 产出，前端表格 / 排序 / 选择直接消费 */
export interface FileItem {
  name: string
  isDirectory: boolean
  /** 相对于根目录的 POSIX 路径 */
  filePath: string
  /** KB 字符串，由服务端 toFixed(2) 产出；前端排序时 parseFloat */
  size: string
  birthtime: string
  updatetime: string
  /** 时间戳（ms），供前端展示相对时间 */
  mtime: number
  hasDel: boolean
  /** 前端 decorate 时附加：文件图标 class */
  icon?: string
  /** 前端 decorate 时附加：相对时间文案 */
  relativeTime?: string
}

/** 统一响应包装。isExit = 1 表示目标已存在 */
export interface ApiResponse<T = unknown> {
  code: number
  data?: T
  message?: string
  isExit?: 0 | 1
}

/** /api/list 响应 */
export interface ListResult extends ApiResponse<FileItem[]> {
  hasDel: boolean
}

/** /api/move 响应中 data 的每一项 */
export interface MoveResult {
  code: number
  message: string
  data?: boolean
  isExit?: 0 | 1
}

/** /api/delete 失败响应里 data 的形状 */
export interface DeleteFailure {
  failedDeletions: string[]
}

/** 右键 / 行内菜单项，action 与页面里处理函数的 map 键一致 */
export interface MenuItem {
  label: string
  action: string
}

/** /api/list 与 /api/create 等接口接收的路径，统一为路径片段数组 */
export type PathSegments = string[]

/** 列表接口请求体 */
export interface ListBody {
  /** 搜索关键字 */
  name?: string
  filePath?: string | PathSegments
  /** 只返回目录（移动对话框用） */
  isDirectory?: boolean
}

/** 新建文件夹请求体 */
export interface CreateBody {
  filePath?: string | PathSegments
  name?: string
}

/** 重命名请求体 */
export interface RenameBody {
  filePath?: string
  newName?: string
}

/** 移动请求体 */
export interface MoveBody {
  filePaths?: (string | PathSegments)[]
  newFolder?: string | PathSegments
}

/** 删除请求体 */
export interface DeleteBody {
  filePaths?: (string | PathSegments)[]
}

/** 上传成功的响应 */
export interface UploadResult {
  code: number
  message: string
  /** 实际落盘的文件名（重名时带序号） */
  data: string[]
}

/** 主题取值，与 localStorage 中持久化的值一致 */
export type Theme = 'light' | 'dark'
