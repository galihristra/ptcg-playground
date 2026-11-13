import { create } from 'zustand'

interface UiState {
  /** Card open in the detail drawer */
  openCardId: string | null
  toast: { id: number; message: string } | null
  openCard: (id: string | null) => void
  showToast: (message: string) => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set, get) => ({
  openCardId: null,
  toast: null,
  openCard: (id) => set({ openCardId: id }),
  showToast: (message) => {
    const id = ++toastSeq
    set({ toast: { id, message } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3500)
  },
}))
