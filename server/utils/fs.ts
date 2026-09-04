import { existsSync, mkdirSync } from 'node:fs'
import { rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 删除文件或文件夹（含内容）。
 * 必须使用异步 API：rmSync 在删除大目录时（尤其网络盘）会阻塞事件循环，
 * 导致期间所有用户的请求无响应。
 */
export async function deleteFileOrFolder(target: string): Promise<void> {
  const stats = await stat(target)

  if (stats.isDirectory()) {
    await rm(target, { recursive: true, force: true })
  } else {
    await unlink(target)
  }
}

/** 新建文件夹的结果：1 成功 / 2 已存在 / 0 失败 */
export type CreateFolderResult = 0 | 1 | 2

/**
 * 新建文件夹
 */
export function createFolder(dir: string, name: string): CreateFolderResult {
  const target = join(dir, name)

  // recursive 模式下已存在不会抛 EEXIST，需先显式判断
  if (existsSync(target)) {
    return 2
  }

  try {
    // 名称已通过 assertValidName 校验（不含路径分隔符），可安全递归创建父级
    mkdirSync(target, { recursive: true })
    return 1
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return 2
    }
    return 0
  }
}
