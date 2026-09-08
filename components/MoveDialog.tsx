'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FileItem, ListBody, ListResult } from '@/lib/types'
import { apiFetch } from '@/lib/client/request'
import { reportError } from '@/lib/client/error'
import { folderIcon } from '@/lib/client/fileIcon'
import { Transition } from './Transition'

interface MoveDialogProps {
  open: boolean
  onSubmit: (filePath: string) => void
  onClose: () => void
}

const ROOT_ITEM: FileItem = {
  name: '根目录',
  filePath: '',
  isDirectory: true,
  size: '0',
  birthtime: '',
  updatetime: '',
  mtime: 0,
  hasDel: false
}

/** 目录树选择器：逐列下钻，确定后把目标目录的相对路径交给调用方 */
export function MoveDialog({ open, onSubmit, onClose }: MoveDialogProps) {
  /** 目录树的每一层 */
  const [tree, setTree] = useState<FileItem[][]>([])
  const [selectFolderPath, setSelectFolderPath] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadChildren = useCallback(async (item: { filePath: string }, index: number) => {
    setSelectFolderPath(item.filePath)

    try {
      const res = await apiFetch<ListResult>('/api/list', {
        method: 'POST',
        body: {
          isDirectory: true,
          filePath: item.filePath.split('/').filter(Boolean)
        } satisfies ListBody
      })

      setTree((prev) => {
        const next = prev.slice(0, index + 1)

        if (res?.data?.length) {
          next.push(res.data)
        }

        return next
      })
    } catch (error) {
      reportError(error, '读取目录失败')
    }
  }, [])

  // 每次打开都重置为根目录，避免残留上次的层级
  useEffect(() => {
    if (!open) {
      return
    }

    setTree([[ROOT_ITEM]])
    setSelectFolderPath('')
    void loadChildren({ filePath: '' }, 0)
  }, [open, loadChildren])

  if (!mounted) {
    return null
  }

  const submit = () => {
    onSubmit(selectFolderPath)
    onClose()
  }

  return createPortal(
    <Transition name="modal" show={open} duration={300}>
      <div className="modal-mask">
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="选择文件夹">
          <header className="modal-header">选择文件夹</header>
          <section className="modal-content">
            {tree.map((items, index) => (
              <div key={index} className="modal-list">
                {items.map((cur) => (
                  <div
                    key={cur.filePath}
                    className={`modal-item${selectFolderPath === cur.filePath ? ' active' : ''}`}
                    title={cur.name}
                    onClick={() => void loadChildren(cur, index)}
                  >
                    <img className="icon" src={folderIcon(cur.name)} alt="" width={14} height={14} />
                    <div className="name">{cur.name}</div>
                  </div>
                ))}
              </div>
            ))}
          </section>
          <footer className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              关闭
            </button>
            <button type="button" className="btn btn-primary" onClick={submit}>
              确定
            </button>
          </footer>
        </div>
      </div>
    </Transition>,
    document.body
  )
}
