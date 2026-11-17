import { create } from 'zustand'

export type View = 'builder' | 'playtest'

interface UiState {
  /** Which screen is showing. There is no router. */
  view: View
  /** Card open in the detail drawer */
  openCardId: string | null
  toast: { id: number; message: string } | null
  setView: (view: View) => void
  openCard: (id: string | null) => void
  showToast: (message: string) => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set, get) => ({
  view: 'builder',
  openCardId: null,
  toast: null,
  setView: (view) => set({ view }),
  openCard: (id) => set({ openCardId: id }),
  showToast: (message) => {
    const id = ++toastSeq
    set({ toast: { id, message } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3500)
  },
}))
