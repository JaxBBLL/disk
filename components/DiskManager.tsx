'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { FileItem, MenuItem, Theme } from '@/lib/types'
import { useFileAction } from '@/lib/client/useFileAction'
import { useFileList } from '@/lib/client/useFileList'
import { applyTheme, readTheme, saveTheme, watchSystemTheme } from '@/lib/client/theme'
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon, ThemeIcon } from './icons'
import { ContextMenu } from './ContextMenu'
import { DropZone } from './DropZone'
import { FileBreadcrumb } from './FileBreadcrumb'
import { FileTable } from './FileTable'
import { MoveDialog } from './MoveDialog'
import { Transition } from './Transition'

const COMMON_MENU: MenuItem[] = [
  { label: '上传文件', action: '4' },
  { label: '上传文件夹', action: '5' },
  { label: '新建文件夹', action: '6' }
]

const THEME_ITEMS: { value: Theme; label: string; icon: () => ReactElement }[] = [
  { value: 'light', label: '浅色模式', icon: SunIcon },
  { value: 'dark', label: '深色模式', icon: MoonIcon },
  { value: 'system', label: '跟随系统', icon: MonitorIcon }
]

/**
 * 文件管理器主界面，对应原 app/pages/index.vue。
 * 页面本身是客户端组件（与原 ssr:false 的 SPA 语义一致）。
 */
export function DiskManager() {
  const {
    list,
    loading,
    setLoading,
    hasDel,
    paths,
    keyword,
    setKeyword,
    refresh,
    navigate,
    entryDirectory
  } = useFileList()

  const {
    uploading,
    uploadingLabel,
    pickAndUploadFiles,
    pickAndUploadFolder,
    uploadDropped,
    downloadItems,
    previewItem,
    renameItem,
    createFolder,
    removeItems,
    moveItems
  } = useFileAction({ paths, refresh, setLoading })

  const [selected, setSelected] = useState<FileItem[]>([])
  const [moveOpen, setMoveOpen] = useState(false)
  const moveTargets = useRef<FileItem[]>([])

  const [uploadOpen, setUploadOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [theme, setThemeState] = useState<Theme>('system')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  const pathKey = paths.join('/')
  const dropTarget = pathKey || '根目录'

  // 切换目录时清空选择，避免残留上一目录的选中项
  useEffect(() => {
    setSelected([])
  }, [pathKey])

  // ---------- 主题 ----------
  useEffect(() => {
    const saved = readTheme()

    setThemeState(saved)
    applyTheme(saved)

    // 系统主题变化时，若用户选择「跟随系统」则同步切换
    return watchSystemTheme()
  }, [])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    saveTheme(next)
    applyTheme(next)
  }

  // ---------- 右键菜单 ----------
  const buildMenu = useCallback(
    (item?: FileItem | null): MenuItem[] => {
      if (!item) {
        return [{ label: '刷新', action: '-1' }, ...COMMON_MENU]
      }

      const head: MenuItem[] = item.isDirectory
        ? [
            { label: '打开', action: '0' },
            { label: '下载文件夹', action: '1' }
          ]
        : [{ label: '下载', action: '1' }]

      const tail: MenuItem[] = [
        { label: '重命名', action: '2' },
        { label: '移动', action: '7' }
      ]

      const del: MenuItem[] = hasDel ? [{ label: '删除', action: '3' }] : []

      return [...head, ...tail, ...del, ...COMMON_MENU]
    },
    [hasDel]
  )

  const handleBeforeShow = useCallback(
    (item: FileItem | null) => {
      setMenuItems(buildMenu(item))
    },
    [buildMenu]
  )

  const openMove = useCallback((items: FileItem[]) => {
    if (!items.length) {
      return
    }
    moveTargets.current = [...items]
    setMoveOpen(true)
  }, [])

  const handleRowAction = useCallback(
    (item: FileItem | null, action: MenuItem) => {
      const map: Record<string, () => void> = {
        '-1': () => void refresh(),
        '0': () => item && entryDirectory(item.name),
        '1': () => item && downloadItems([item]),
        '2': () => item && void renameItem(item),
        '3': () => item && void removeItems([item]),
        '4': () => pickAndUploadFiles(),
        '5': () => pickAndUploadFolder(),
        '6': () => void createFolder(),
        '7': () => item && openMove([item])
      }

      map[action?.action]?.()
    },
    [
      createFolder,
      downloadItems,
      entryDirectory,
      openMove,
      pickAndUploadFiles,
      pickAndUploadFolder,
      refresh,
      removeItems,
      renameItem
    ]
  )

  const submitMove = useCallback(
    async (target: string) => {
      await moveItems(moveTargets.current, target)
    },
    [moveItems]
  )

  const handleDropMove = useCallback(
    (origin: FileItem, target: FileItem) => {
      if (!origin || !target?.isDirectory) {
        return
      }
      void moveItems([origin], target.filePath)
    },
    [moveItems]
  )

  const gotoBreadcrumb = useCallback(
    (depth: number) => navigate(depth === 0 ? [] : paths.slice(0, depth)),
    [navigate, paths]
  )

  const watermark = useMemo(() => Array.from({ length: 48 }, (_, index) => index), [])

  return (
    <ContextMenu
      menu={menuItems}
      onAction={(_event, item) => handleRowAction(null, item)}
      onBefore={() => handleBeforeShow(null)}
    >
      {(handle) => (
        <>
          <DropZone target={dropTarget} onDropFiles={uploadDropped}>
            <div className="app" onContextMenu={handle}>
              <header className="header">
                <div className="header-main">
                  <FileBreadcrumb paths={paths} onNavigate={gotoBreadcrumb} />
                  <input
                    className="input"
                    type="text"
                    placeholder="搜索"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                  <div
                    className="upload-dropdown"
                    onMouseEnter={() => setUploadOpen(true)}
                    onMouseLeave={() => setUploadOpen(false)}
                  >
                    <button type="button" className="btn">
                      上传
                      <span className="caret">▾</span>
                    </button>
                    <Transition name="dropdown-fade" show={uploadOpen} duration={120}>
                      <div className="upload-menu">
                        <button
                          type="button"
                          className="menu-item"
                          onClick={pickAndUploadFiles}
                        >
                          上传文件
                        </button>
                        <button
                          type="button"
                          className="menu-item"
                          onClick={pickAndUploadFolder}
                        >
                          上传文件夹
                        </button>
                      </div>
                    </Transition>
                  </div>
                  <div
                    className="theme-dropdown"
                    onMouseEnter={() => setThemeOpen(true)}
                    onMouseLeave={() => setThemeOpen(false)}
                  >
                    <button type="button" className="btn theme-toggle" title="主题模式">
                      <ThemeIcon theme={theme} />
                      <span className="caret">▾</span>
                    </button>
                    <Transition name="dropdown-fade" show={themeOpen} duration={120}>
                      <div className="theme-menu">
                        {THEME_ITEMS.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            className={`menu-item${theme === item.value ? ' active' : ''}`}
                            onClick={() => setTheme(item.value)}
                          >
                            <item.icon />
                            <span>{item.label}</span>
                            {theme === item.value && <CheckIcon />}
                          </button>
                        ))}
                      </div>
                    </Transition>
                  </div>
                </div>
              </header>

              <main className="main">
                <div className="upload-watermark" aria-hidden="true">
                  {watermark.map((index) => (
                    <span key={index}>支持拖拽上传</span>
                  ))}
                </div>

                <FileTable
                  list={list}
                  loading={loading}
                  menu={menuItems}
                  selected={selected}
                  onSelectedChange={setSelected}
                  onOpen={(item) => entryDirectory(item.name)}
                  onPreview={previewItem}
                  onUpload={pickAndUploadFiles}
                  onDropMove={handleDropMove}
                  onContextBefore={handleBeforeShow}
                  onContextAction={handleRowAction}
                />
              </main>
            </div>
          </DropZone>

          <MoveDialog
            open={moveOpen}
            onSubmit={submitMove}
            onClose={() => setMoveOpen(false)}
          />

          {/* 底部批量操作栏 */}
          <Transition name="batch" show={selected.length > 0} duration={200}>
            <div className="batch-bar">
              <span className="batch-count">已选 {selected.length} 项</span>
              <button type="button" className="btn-text" onClick={() => downloadItems(selected)}>
                下载
              </button>
              <button type="button" className="btn-text" onClick={() => openMove(selected)}>
                移动
              </button>
              {hasDel && (
                <button
                  type="button"
                  className="btn-text btn-danger"
                  onClick={() => void removeItems(selected)}
                >
                  删除
                </button>
              )}
              <button type="button" className="btn-text batch-clear" onClick={() => setSelected([])}>
                取消选择
              </button>
            </div>
          </Transition>

          {/* 上传进度提示 */}
          <Transition name="toast" show={uploading} duration={200}>
            <div className="upload-progress">
              <span className="spinner" aria-hidden="true" />
              <span>{uploadingLabel}</span>
            </div>
          </Transition>
        </>
      )}
    </ContextMenu>
  )
}
