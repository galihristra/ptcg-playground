import { useMemo, useState } from 'react'
import { getCard } from '../../lib/cards'
import { checkStandardLegality } from '../../lib/legality'
import { refreshCards } from '../../lib/playtest/hydrate'
import type { Category } from '../../lib/types'
import { canAddCopy, DECK_SIZE, isAceSpec, totalCards, validateDeck, type DeckEntry } from '../../lib/validation'
import { useActiveDeck, useDeckStore } from '../../store/deckStore'
import { usePlaytestStore } from '../../store/playtestStore'
import { useUiStore } from '../../store/uiStore'
import { ImportExportDialog } from '../import-export/ImportExportDialog'
import { useValidationContext } from '../useStandardData'
import { useDeckActions, useDeckEntries } from './useDeckActions'

const GROUPS: { category: Category; label: string }[] = [
  { category: 'Pokemon', label: 'Pokémon' },
  { category: 'Trainer', label: 'Trainer' },
  { category: 'Energy', label: 'Energy' },
]

const smallBtn = 'rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40'

export function DeckPanel() {
  const deck = useActiveDeck()
  const decks = useDeckStore((s) => s.decks)
  const store = useDeckStore.getState()
  const entries = useDeckEntries()
  const ctx = useValidationContext()
  const { addById, removeById } = useDeckActions()
  const openCard = useUiStore((s) => s.openCard)
  const [dialog, setDialog] = useState<'import' | 'export' | null>(null)
  const [starting, setStarting] = useState(false)

  const result = useMemo(() => validateDeck(entries, ctx), [entries, ctx])
  const flagged = useMemo(() => new Set(result.errors.flatMap((e) => e.cardIds ?? [])), [result])
  const deckList = Object.values(decks).sort((a, b) => a.name.localeCompare(b.name))
  const empty = entries.length === 0

  /** Fills in card data older saved decks are missing (never throws), then opens the playtest screen. */
  const startPlaytest = async () => {
    setStarting(true)
    try {
      const fresh = await refreshCards(entries, getCard)
      if (fresh.refreshed.length > 0) useDeckStore.getState().refreshCards(fresh.refreshed)
      usePlaytestStore.getState().start(fresh.entries)
      useUiStore.getState().setView('playtest')
    } finally {
      setStarting(false)
    }
  }

  const confirmThen = (message: string, action: () => void) => {
    if (empty || window.confirm(message)) action()
  }

  return (
    <section aria-label="Deck" className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="space-y-2 border-b border-slate-800 p-3">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="deck-select">
            Saved decks
          </label>
          <select
            id="deck-select"
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm"
            value={deck.id}
            onChange={(e) => store.selectDeck(e.target.value)}
          >
            {deckList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || 'Untitled'} ({totalCards(Object.values(d.entries))})
              </option>
            ))}
          </select>
          <button type="button" className={smallBtn} onClick={store.newDeck}>
            New
          </button>
        </div>
        <label className="sr-only" htmlFor="deck-name">
          Deck name
        </label>
        <input
          id="deck-name"
          className="h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-base font-semibold focus:border-amber-400"
          value={deck.name}
          placeholder="Deck name"
          onChange={(e) => store.renameDeck(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded-md bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
            disabled={empty || starting}
            onClick={() => void startPlaytest()}
          >
            {starting ? 'Loading…' : 'Playtest'}
          </button>
          <button type="button" className={smallBtn} onClick={() => setDialog('import')}>
            Import
          </button>
          <button type="button" className={smallBtn} disabled={empty} onClick={() => setDialog('export')}>
            Export
          </button>
          <button type="button" className={smallBtn} onClick={store.duplicateDeck}>
            Duplicate
          </button>
          <button type="button" className={smallBtn} disabled={empty} onClick={() => confirmThen('Remove every card from this deck?', store.clearDeck)}>
            Clear
          </button>
          <button type="button" className={`${smallBtn} text-red-300`} onClick={() => confirmThen(`Delete “${deck.name}”?`, store.deleteDeck)}>
            Delete
          </button>
        </div>
      </div>

      <div className="border-b border-slate-800 p-3" aria-live="polite">
        <div className="flex items-baseline justify-between">
          <span className={`text-2xl font-bold tabular-nums ${result.total === DECK_SIZE ? 'text-emerald-300' : result.total > DECK_SIZE ? 'text-red-300' : 'text-slate-100'}`}>
            {result.total}
            <span className="text-base font-normal text-slate-500"> / {DECK_SIZE}</span>
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${result.valid ? 'bg-emerald-900/60 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
            {result.valid ? 'Standard legal' : `${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
          <div
            className={`h-full ${result.total > DECK_SIZE ? 'bg-red-400' : result.total === DECK_SIZE ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, (result.total / DECK_SIZE) * 100)}%` }}
          />
        </div>
        {!empty && (result.errors.length > 0 || result.warnings.length > 0) && (
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
            {result.errors.map((issue, i) => (
              <li key={`e${i}`} className="flex gap-1.5 text-red-300">
                <span aria-hidden>✕</span>
                <span>{issue.message}</span>
              </li>
            ))}
            {result.warnings.map((issue, i) => (
              <li key={`w${i}`} className="flex gap-1.5 text-amber-300">
                <span aria-hidden>!</span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
        {!ctx.ready && !empty && <p className="mt-2 text-xs text-slate-500">Loading reprint and ACE SPEC data — legality checks may be incomplete.</p>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {empty ? (
          <div className="mt-8 text-center text-sm text-slate-400">
            <p className="font-medium text-slate-200">This deck is empty.</p>
            <p className="mt-1">Press + on a card to add it, or import a decklist.</p>
          </div>
        ) : (
          GROUPS.map(({ category, label }) => {
            const group = entries.filter((e) => e.card.category === category).sort((a, b) => a.card.name.localeCompare(b.card.name))
            if (group.length === 0) return null
            return (
              <div key={category} className="mb-4">
                <h3 className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span>{label}</span>
                  <span className="tabular-nums">{totalCards(group)}</span>
                </h3>
                <ul>
                  {group.map((e) => (
                    <DeckRow
                      key={e.card.id}
                      entry={e}
                      flagged={flagged.has(e.card.id)}
                      canAdd={canAddCopy(entries, e.card, ctx)}
                      badge={
                        isAceSpec(e.card, ctx.aceSpecNames)
                          ? 'ACE SPEC'
                          : checkStandardLegality(e.card, ctx).reason === 'reprint'
                            ? 'reprint'
                            : undefined
                      }
                      onAdd={() => void addById(e.card.id)}
                      onRemove={() => removeById(e.card.id)}
                      onOpen={() => openCard(e.card.id)}
                    />
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </div>

      {dialog && <ImportExportDialog initialMode={dialog} onClose={() => setDialog(null)} />}
    </section>
  )
}

interface RowProps {
  entry: DeckEntry
  flagged: boolean
  canAdd: boolean
  badge?: string
  onAdd: () => void
  onRemove: () => void
  onOpen: () => void
}

function DeckRow({ entry, flagged, canAdd, badge, onAdd, onRemove, onOpen }: RowProps) {
  const { card, count } = entry
  return (
    <li className={`flex items-center gap-2 rounded-md px-1 py-1 ${flagged ? 'bg-red-950/40' : 'hover:bg-slate-900'}`}>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{count}</span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm ${flagged ? 'text-red-200' : ''}`}>{card.name}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {card.set.name} · {card.localId}
          {badge ? ` · ${badge}` : ''}
        </span>
      </button>
      <button type="button" aria-label={`Remove one ${card.name}`} onClick={onRemove} className="h-7 w-7 rounded-md bg-slate-800 font-bold hover:bg-slate-700">
        −
      </button>
      <button
        type="button"
        aria-label={`Add one ${card.name}`}
        disabled={!canAdd}
        onClick={onAdd}
        className="h-7 w-7 rounded-md bg-slate-800 font-bold hover:bg-slate-700 disabled:opacity-30"
      >
        +
      </button>
    </li>
  )
}
