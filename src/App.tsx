import { useState } from 'react'
import { CardBrowser } from './features/browser/CardBrowser'
import { CardDrawer } from './features/browser/CardDrawer'
import { DeckPanel } from './features/deck/DeckPanel'
import { useDeckEntries } from './features/deck/useDeckActions'
import { DECK_SIZE, totalCards } from './lib/validation'
import { useActiveDeck } from './store/deckStore'
import { useUiStore } from './store/uiStore'

export default function App() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const deck = useActiveDeck()
  const total = totalCards(useDeckEntries())
  const toast = useUiStore((s) => s.toast)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
        <h1 className="text-base font-semibold">
          Deck Builder <span className="font-normal text-slate-500">· Pokémon TCG Standard</span>
        </h1>
        <span className="text-xs text-slate-500">Card data: TCGdex</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col pb-12 lg:pb-0">
          <CardBrowser />
        </main>

        {/* Desktop: side panel */}
        <aside className="hidden w-96 shrink-0 border-l border-slate-800 lg:block">
          <DeckPanel />
        </aside>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="lg:hidden">
        {sheetOpen && <button type="button" aria-label="Close deck" className="fixed inset-0 z-20 bg-black/60" onClick={() => setSheetOpen(false)} />}
        <div className={`fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-slate-700 bg-slate-950 shadow-2xl ${sheetOpen ? 'h-[82dvh]' : 'h-12'}`}>
          <button
            type="button"
            aria-expanded={sheetOpen}
            aria-controls="deck-sheet"
            onClick={() => setSheetOpen((v) => !v)}
            className="flex h-12 shrink-0 items-center justify-between px-4 text-sm"
          >
            <span className="truncate font-semibold">{deck.name || 'Untitled'}</span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className={total === DECK_SIZE ? 'text-emerald-300' : total > DECK_SIZE ? 'text-red-300' : ''}>
                {total} / {DECK_SIZE}
              </span>
              <span aria-hidden>{sheetOpen ? '▾' : '▴'}</span>
            </span>
          </button>
          {sheetOpen && (
            <div id="deck-sheet" className="min-h-0 flex-1">
              <DeckPanel />
            </div>
          )}
        </div>
      </div>

      <CardDrawer />

      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-4 lg:bottom-6">
        {toast && <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-lg">{toast.message}</div>}
      </div>
    </div>
  )
}
