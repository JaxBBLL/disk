// 均为浏览器端工具，只在事件回调中调用，不涉及 SSR

// 与服务端 lib/server/path.ts 中的校验规则保持一致
export const ILLEGAL_NAME_CHARS = /[<>:"/\\|?*]/

/** 拖拽/选择后展开出的条目：浏览器原生 File + 用于还原层级的相对路径 */
export interface DropItem {
  file: File
  relativePath: string
}

/**
 * webkitdirectory 下 input.files 里的对象既有 File 的字段，
 * 也可能带 FileSystemDirectoryEntry 的 isDirectory / createReader（部分浏览器）。
 * 这里用交叉类型表达这种鸭子类型，避免用 any。
 */
type MaybeEntry = File & Partial<FileSystemDirectoryEntry>

function readDirectory(directoryReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    directoryReader.readEntries(resolve, reject)
  })
}

async function collectFiles(entries: MaybeEntry[], files: File[] = []): Promise<File[]> {
  for (const entry of entries) {
    if (entry.isDirectory) {
      const reader = entry.createReader?.()
      if (!reader) {
        continue
      }
      const children = await readDirectory(reader)
      await collectFiles(children as unknown as MaybeEntry[], files)
    } else {
      files.push(entry)
    }
  }
  return files
}

/** 选择多个文件 */
export function selectFiles(onPicked: (files: FileList) => void): void {
  const input = document.createElement('input')
  input.type = 'file'

  if (navigator.userAgent.indexOf('Weixin') === -1) {
    input.multiple = true
  }

  input.addEventListener('change', (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const files = target?.files
    if (!files?.length) {
      return
    }
    onPicked?.(files)
  })

  input.click()
}

/** 选择整个文件夹（webkitdirectory） */
export function selectFolder(onPicked: (files: File[]) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.setAttribute('directory', '')
  input.setAttribute('webkitdirectory', '')

  input.addEventListener('change', async () => {
    const fileList = input.files
    if (!fileList?.length) {
      return
    }
    onPicked?.(await collectFiles(Array.from(fileList) as unknown as MaybeEntry[]))
  })

  input.click()
}

/** 通过临时 <a> 触发浏览器下载 */
export function downloadByUrl(url: string): void {
  const link = document.createElement('a')
  link.href = url
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// ---------- 拖拽上传 ----------

/** 读取目录的全部子项。readEntries 单次最多返回 100 条，必须循环读到空为止 */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = []
    const step = () => {
      reader.readEntries((batch: FileSystemEntry[]) => {
        if (!batch.length) {
          resolve(all)
          return
        }
        all.push(...batch)
        step()
      }, reject)
    }
    step()
  })
}

/**
 * 同步收集拖入的条目。
 * 必须在 drop 事件回调里同步调用：事件结束（尤其是 await 之后）dataTransfer 就会失效，
 * webkitGetAsEntry() 届时会返回 null。
 */
export function collectDropEntries(
  dataTransfer?: DataTransfer | null
): (FileSystemEntry | File)[] {
  const entries: (FileSystemEntry | File)[] = []

  for (const item of Array.from(dataTransfer?.items || [])) {
    if (item.kind !== 'file') {
      continue
    }
    const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
    if (entry) {
      entries.push(entry)
    } else {
      const file = item.getAsFile()
      if (file) {
        entries.push(file)
      }
    }
  }

  return entries
}

/**
 * 递归展开拖入的文件 / 目录，返回 [{ file, relativePath }]。
 * relativePath 以拖入项的名称为根，用于在服务端还原目录层级。
 */
export async function walkDropEntry(
  entry: FileSystemEntry | File,
  prefix = ''
): Promise<DropItem[]> {
  // 不带 isFile/isDirectory 的说明已经是 File 对象（浏览器不支持 entry 时的兜底）
  const fsEntry = entry as Partial<FileSystemEntry>

  if (fsEntry.isFile !== true && fsEntry.isDirectory !== true) {
    const file = entry as File
    return [{ file, relativePath: prefix ? `${prefix}/${file.name}` : file.name }]
  }

  if (fsEntry.isFile) {
    const fileEntry = fsEntry as FileSystemFileEntry
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject))
    return [{ file, relativePath: prefix ? `${prefix}/${file.name}` : file.name }]
  }

  const dirEntry = fsEntry as FileSystemDirectoryEntry
  const children = await readAllEntries(dirEntry.createReader())
  const next = prefix ? `${prefix}/${dirEntry.name}` : dirEntry.name
  const out: DropItem[] = []

  for (const child of children) {
    out.push(...(await walkDropEntry(child, next)))
  }

  return out
}
