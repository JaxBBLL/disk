/**
 * 文件 / 文件夹图标。
 *
 * 统一走 @baybreezy/file-extension-icon（Material 主题），它返回 base64 编码的
 * SVG data URI，可直接作为 <img src> 使用，无需引入任何字体或 CSS。
 * 收口在这里，方便后续整体切换到 VSCode 主题。
 */
import { getMaterialFileIcon, getMaterialFolderIcon } from '@baybreezy/file-extension-icon'

/** 文件图标（按文件名 / 扩展名匹配） */
export function fileIcon(name: string): string {
  return getMaterialFileIcon(name)
}

/** 文件夹图标，open = true 时返回展开态 */
export function folderIcon(name: string, open = false): string {
  return getMaterialFolderIcon(name, open)
}
