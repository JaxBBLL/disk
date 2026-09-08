import { createStore, useStore } from './store'

export type DialogKind = 'confirm' | 'prompt'

export interface DialogState {
  open: boolean
  kind: DialogKind | null
  title: string
  message: string
  value: string
  resolve: ((result: string | boolean | null) => void) | null
}

const store = createStore<DialogState>({
  open: false,
  kind: null,
  title: '',
  message: '',
  value: '',
  resolve: null
})

/** 全局 promise 化对话框，替代 window.confirm / window.prompt */
export function useDialog() {
  const state = useStore(store, (current) => current)

  function open(
    kind: DialogKind,
    options: { title: string; message: string; value?: string }
  ): Promise<string | boolean | null> {
    return new Promise((resolve) => {
      store.setState({
        kind,
        title: options.title,
        message: options.message,
        value: options.value ?? '',
        resolve,
        open: true
      })
    })
  }

  const confirm = (message: string, title = '确认'): Promise<boolean> =>
    open('confirm', { title, message }) as Promise<boolean>

  const prompt = (message: string, title = '输入', value = ''): Promise<string | null> =>
    open('prompt', { title, message, value }) as Promise<string | null>

  const submit = () => {
    const current = store.getState()
    const result = current.kind === 'prompt' ? current.value : true

    store.setState({ ...current, open: false, resolve: null })
    current.resolve?.(result)
  }

  const cancel = () => {
    const current = store.getState()

    store.setState({ ...current, open: false, resolve: null })
    current.resolve?.(current.kind === 'prompt' ? null : false)
  }

  const setValue = (value: string) => {
    store.setState((current) => ({ ...current, value }))
  }

  return { state, confirm, prompt, submit, cancel, setValue }
}
