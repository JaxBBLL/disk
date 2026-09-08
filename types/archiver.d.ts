/**
 * archiver v8 的类型缺口补充。
 *
 * archiver v8 起为纯 ESM 具名导出，导出的是 ZipArchive 类而不是工厂函数，
 * 而 @types/archiver 仍停留在 v5 的 `archiver(format, options)` 工厂签名，
 * 无法描述 `new ZipArchive()`。这里给出本项目实际用到的最小声明：
 * 类继承 Readable，因此可通过 Readable.toWeb 直接作为响应体推流。
 */
declare module 'archiver' {
  import type { Readable } from 'node:stream'

  interface ZipArchiveOptions {
    zlib?: { level?: number }
  }

  interface EntryData {
    name: string
  }

  export class ZipArchive extends Readable {
    constructor(options?: ZipArchiveOptions)
    /** 归档单个文件，name 为压缩包内的路径 */
    file(source: string, data: EntryData): this
    /** 归档整个目录，destPath 为压缩包内的父目录名 */
    directory(source: string, destPath: string | false): this
    append(source: string | Buffer, data?: EntryData): this
    finalize(): Promise<void>
  }
}
