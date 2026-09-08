'use client'

import { useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, ReactNode } from 'react'
import { collectDropEntries, walkDropEntry } from '@/lib/client/file'
import type { DropItem } from '@/lib/client/file'
import { Transition } from './Transition'

interface DropZoneProps {
  /** 遮罩上展示的目标路径 */
  target?: string
  onDropFiles: (items: DropItem[]) => void
  children: ReactNode
}

/** 拖拽区：覆盖整页，拖到任意位置都能上传；同时支持拖入整个文件夹 */
export function DropZone({ target = '', onDropFiles, children }: DropZoneProps) {
  const [active, setActive] = useState(false)
  const depth = useRef(0)

  const hasFiles = (event: ReactDragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes('Files')

  const onDragEnter = (event: ReactDragEvent) => {
    if (!hasFiles(event)) {
      return
    }
    // 计数器法：dragenter/dragleave 在子元素间移动时会成对触发，
    // 用计数而不是布尔值才能避免遮罩闪烁
    depth.current += 1
    setActive(true)
  }

  const onDragOver = (event: ReactDragEvent) => {
    if (!hasFiles(event)) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1)
    if (!depth.current) {
      setActive(false)
    }
  }

  async function onDrop(event: ReactDragEvent) {
    if (!hasFiles(event)) {
      return
    }
    event.preventDefault()
    depth.current = 0
    setActive(false)

    // 同步收集 entry（事件结束后 dataTransfer 失效），再异步展开目录树
    const entries = collectDropEntries(event.dataTransfer)

    if (!entries.length) {
      return
    }

    const items: DropItem[] = []

    for (const entry of entries) {
      items.push(...(await walkDropEntry(entry, '')))
    }

    if (items.length) {
      onDropFiles(items)
    }
  }

  return (
    <div
      className="dropzone"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}

      <Transition name="dropzone-fade" show={active} duration={150}>
        <div className="dropzone-mask">
          <div className="dropzone-card">
            <svg
              className="dropzone-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div className="dropzone-title">松开鼠标，上传到「{target}」</div>
            <div className="dropzone-sub">支持文件与文件夹，自动保留目录层级</div>
          </div>
        </div>
      </Transition>
    </div>
  )
}
