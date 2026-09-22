export type DialogKind = 'confirm' | 'prompt'

export interface DialogState {
  open: boolean
  kind: DialogKind | null
  title: string
  message: string
  value: string
  resolve: ((result: string | boolean | null) => void) | null
}

const state = reactive<DialogState>({
  open: false,
  kind: null,
  title: '',
  message: '',
  value: '',
  resolve: null
})

/** 全局 promise 化对话框，替代 window.confirm / window.prompt */
export function useDialog() {
  function open(
    kind: DialogKind,
    options: { title: string; message: string; value?: string }
  ): Promise<string | boolean | null> {
    return new Promise((resolve) => {
      state.kind = kind
      state.title = options.title
      state.message = options.message
      state.value = options.value ?? ''
      state.resolve = resolve
      state.open = true
    })
  }

  const confirm = (message: string, title = '确认'): Promise<boolean> =>
    open('confirm', { title, message }) as Promise<boolean>

  const prompt = (message: string, title = '输入', value = ''): Promise<string | null> =>
    open('prompt', { title, message, value }) as Promise<string | null>

  const submit = () => {
    const result = state.kind === 'prompt' ? state.value : true
    state.open = false
    state.resolve?.(result)
    state.resolve = null
  }

  const cancel = () => {
    state.open = false
    state.resolve?.(state.kind === 'prompt' ? null : false)
    state.resolve = null
  }

  return { state, confirm, prompt, submit, cancel }
}
