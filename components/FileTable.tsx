'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { FileItem, MenuItem } from '@/lib/types'
import { useDrop } from '@/lib/client/useDrop'
import { ContextMenu } from './ContextMenu'
import { ListSkeleton } from './ListSkeleton'

type SortKey = 'name' | 'size' | 'mtime'

interface FileTableProps {
  list?: FileItem[]
  loading?: boolean
  menu?: MenuItem[]
  selected: FileItem[]
  onSelectedChange: (items: FileItem[]) => void
  onOpen: (item: FileItem) => void
  onPreview: (item: FileItem) => void
  onUpload: () => void
  onDropMove: (origin: FileItem, target: FileItem) => void
  onContextBefore: (item: FileItem | null) => void
  onContextAction: (item: FileItem | null, action: MenuItem) => void
}

export function FileTable({
  list = [],
  loading = false,
  menu = [],
  selected,
  onSelectedChange,
  onOpen,
  onPreview,
  onUpload,
  onDropMove,
  onContextBefore,
  onContextAction
}: FileTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState(1)

  // 右键所在行：整个表格共用一个菜单实例，避免每行都挂全局监听
  const activeItem = useRef<FileItem | null>(null)

  const sortedList = useMemo<FileItem[]>(() => {
    const arr = [...list]

    arr.sort((a, b) => {
      // 目录永远排在文件前面
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }

      let result = 0

      if (sortKey === 'size') {
        result =
          (a.isDirectory ? 0 : parseFloat(a.size) || 0) -
          (b.isDirectory ? 0 : parseFloat(b.size) || 0)
      } else if (sortKey === 'mtime') {
        result = (a.mtime || 0) - (b.mtime || 0)
      } else {
        result = a.name.localeCompare(b.name, 'zh-Hans-CN')
      }

      return result * sortDir
    })

    return arr
  }, [list, sortKey, sortDir])

  const allSelected = list.length > 0 && selected.length === list.length
  const indeterminate = selected.length > 0 && selected.length !== list.length

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => -dir)
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  const { dragStart, drop, dropOver } = useDrop((origin, target) => {
    onDropMove(origin, target)
  })

  const onToggleAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSelectedChange(event.target.checked ? [...list] : [])
  }

  const isSelected = (item: FileItem) =>
    selected.some((cur) => cur.filePath === item.filePath)

  const toggleItem = (item: FileItem) => {
    onSelectedChange(
      isSelected(item)
        ? selected.filter((cur) => cur.filePath !== item.filePath)
        : [...selected, item]
    )
  }

  // 列表变化后清理已不存在的选择项
  useEffect(() => {
    onSelectedChange(
      selected.filter((item) => list.some((cur) => cur.filePath === item.filePath))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list])

  const arrow = (key: SortKey) =>
    sortKey === key ? <span className="sort-arrow">{sortDir === 1 ? '↑' : '↓'}</span> : null

  return (
    <ContextMenu
      menu={menu}
      onBefore={() => onContextBefore(activeItem.current)}
      onAction={(_event, action) => onContextAction(activeItem.current, action)}
    >
      {(handle) => (
        <div
          className="main-main"
          onContextMenu={(event) => {
            activeItem.current = null
            handle(event)
          }}
        >
          {loading ? (
            <ListSkeleton />
          ) : list.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <label
                      className={`checkbox${allSelected ? ' is-checked' : ''}${
                        indeterminate ? ' is-half' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = indeterminate
                          }
                        }}
                        onChange={onToggleAll}
                      />
                    </label>
                  </th>
                  <th className="th-sortable" onClick={() => sortBy('name')}>
                    名称{arrow('name')}
                  </th>
                  <th
                    style={{ width: 90 }}
                    className="th-sortable"
                    onClick={() => sortBy('size')}
                  >
                    大小{arrow('size')}
                  </th>
                  <th
                    style={{ width: 110 }}
                    className="th-sortable"
                    onClick={() => sortBy('mtime')}
                  >
                    修改时间{arrow('mtime')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((item) => (
                  <tr
                    key={item.filePath}
                    draggable
                    onDragStart={(event: ReactDragEvent) => dragStart(item, event)}
                    onDragOver={(event: ReactDragEvent) => dropOver(item, event)}
                    onDrop={(event: ReactDragEvent) => drop(item, event)}
                    onContextMenu={(event) => {
                      activeItem.current = item
                      handle(event)
                    }}
                    onClick={() => toggleItem(item)}
                  >
                    <td>
                      <label
                        className={`checkbox child-checkbox${
                          isSelected(item) ? ' is-checked' : ''
                        }`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected(item)}
                          onChange={() => toggleItem(item)}
                        />
                      </label>
                    </td>
                    <td>
                      <div
                        className="file-name"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (item.isDirectory) {
                            onOpen(item)
                          } else {
                            onPreview(item)
                          }
                        }}
                      >
                        {item.icon ? (
                          <img className="icon" src={item.icon} alt="" width={14} height={14} />
                        ) : (
                          <svg
                            className="icon"
                            xmlns="http://www.w3.org/2000/svg"
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                        <div className="file-name-text" title={item.name}>
                          {item.name}
                        </div>
                      </div>
                    </td>
                    <td>{!item.isDirectory && `${item.size} KB`}</td>
                    <td title={item.updatetime}>{item.relativeTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <button type="button" className="empty" onClick={onUpload}>
              <svg
                className="empty-icon"
                xmlns="http://www.w3.org/2000/svg"
                width={40}
                height={40}
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
              <div className="empty-title">这里还没有文件</div>
              <div className="empty-sub">把文件或文件夹拖到页面任意位置，或点击此处上传</div>
            </button>
          )}
        </div>
      )}
    </ContextMenu>
  )
}
