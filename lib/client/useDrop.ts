import { useCallback, useRef } from 'react'
import type { DragEvent } from 'react'
import type { FileItem } from '@/lib/types'

/** 判断是否为从操作系统拖入的外部文件（区别于页面内部的拖拽移动） */
function isExternalFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

/**
 * 行级拖拽移动：把文件/文件夹拖到目标文件夹上。
 * 外部文件拖入一律放行给容器级的 DropZone 处理上传，
 * 否则行上的 preventDefault + dropEffect='none' 会拦截拖拽上传。
 */
export function useDrop(onDrop: (origin: FileItem, target: FileItem) => void) {
  const dragOrigin = useRef<FileItem | null>(null)

  const dragStart = useCallback((item: FileItem, event: DragEvent) => {
    dragOrigin.current = item
    // 显式写入数据：既便于区分内外部拖拽，也让 Firefox 能正常发起拖拽
    event?.dataTransfer?.setData('text/plain', item?.filePath || '')
  }, [])

  const drop = useCallback(
    (target: FileItem, event: DragEvent) => {
      const origin = dragOrigin.current

      if (isExternalFiles(event)) {
        return
      }
      if (target?.isDirectory && origin) {
        onDrop(origin, target)
      }
      dragOrigin.current = null
    },
    [onDrop]
  )

  const dropOver = useCallback((target: FileItem, event: DragEvent) => {
    if (isExternalFiles(event)) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = target?.isDirectory ? 'move' : 'none'
    }
  }, [])

  return { dragStart, drop, dropOver }
}
