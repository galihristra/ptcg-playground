import { useMemo, useState } from 'react'
import type { CardFilters } from '../../lib/types'
import { useActiveDeck } from '../../store/deckStore'
import { useUiStore } from '../../store/uiStore'
import { useDeckActions } from '../deck/useDeckActions'
import { useStandardData } from '../useStandardData'
import { CardGrid, GridSkeleton } from './CardGrid'
import { Filters } from './Filters'
import { useCardSearch } from './useCardSearch'

export function CardBrowser() {
  const [filters, setFilters] = useState<CardFilters>({})
  const [standardOnly, setStandardOnly] = useState(true)
  const search = useCardSearch(filters, standardOnly)
  const standard = useStandardData()
  const deck = useActiveDeck()
  const { addById, removeById } = useDeckActions()
  const openCard = useUiStore((s) => s.openCard)

  const counts = useMemo(
    () => Object.fromEntries(Object.values(deck.entries).map((e) => [e.card.id, e.count])),
    [deck.entries],
  )

  const toggleStandard = (value: boolean) => {
    setStandardOnly(value)
    setFilters((f) => ({ ...f, setId: undefined }))
  }

  return (
    <section aria-label="Card browser" className="flex min-h-0 flex-1 flex-col">
      <Filters filters={filters} onChange={setFilters} standardOnly={standardOnly} onStandardOnlyChange={toggleStandard} />
      <div className="flex items-center justify-between px-3 pt-2 text-xs text-slate-400" aria-live="polite">
        <span>
          {search.isLoading
            ? 'Loading cards…'
            : `${search.cards.length}${search.hasMore ? '+' : ''} card${search.cards.length === 1 ? '' : 's'}${standardOnly ? ' · Standard' : ' · all formats'}`}
        </span>
        {standardOnly && standard.isError && (
          <span className="text-amber-300">
            Reprint data unavailable — older Trainer printings hidden.{' '}
            <button type="button" className="underline" onClick={() => void standard.refetch()}>
              Retry
            </button>
          </span>
        )}
        {standard.data?.stale && <span className="text-amber-300">Using cached legality data (TCGdex unreachable).</span>}
      </div>
      <div className="min-h-0 flex-1">
        {search.isLoading ? (
          <GridSkeleton />
        ) : search.error ? (
          <div role="alert" className="m-6 rounded-lg border border-red-900 bg-red-950/40 p-6 text-center">
            <p className="font-medium">Couldn’t reach the card database.</p>
            <p className="mt-1 text-sm text-slate-400">
              TCGdex didn’t answer after several tries ({search.error.message}). Your decks are saved locally and still work.
            </p>
            <button type="button" onClick={search.retry} className="mt-4 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
              Try again
            </button>
          </div>
        ) : search.cards.length === 0 ? (
          <div className="m-6 rounded-lg border border-slate-800 p-8 text-center text-slate-400">
            <p className="font-medium text-slate-200">No cards match these filters.</p>
            <p className="mt-1 text-sm">
              {standardOnly ? 'Try loosening a filter, or turn off “Standard only” to search every set.' : 'Try loosening a filter.'}
            </p>
            <button type="button" onClick={() => setFilters({})} className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700">
              Reset filters
            </button>
          </div>
        ) : (
          <CardGrid
            cards={search.cards}
            counts={counts}
            onOpen={openCard}
            onAdd={addById}
            onRemove={removeById}
            hasMore={search.hasMore}
            loadMore={search.loadMore}
            isLoadingMore={search.isLoadingMore}
          />
        )}
      </div>
    </section>
  )
}
