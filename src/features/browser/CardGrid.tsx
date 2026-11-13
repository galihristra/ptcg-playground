import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CardBrief } from '../../lib/types'
import { CardTile } from './CardTile'

const GAP = 12
const MIN_TILE = 132

interface Props {
  cards: CardBrief[]
  counts: Record<string, number>
  onOpen: (id: string) => void
  onAdd: (id: string) => Promise<void>
  onRemove: (id: string) => void
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
}

export function CardGrid({ cards, counts, onOpen, onAdd, onRemove, hasMore, loadMore, isLoadingMore }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth - GAP * 2)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const columns = Math.max(2, Math.floor((width + GAP) / (MIN_TILE + GAP)))
  const tileWidth = width > 0 ? (width - GAP * (columns - 1)) / columns : MIN_TILE
  const rowHeight = tileWidth * 1.4 + GAP
  const rowCount = Math.ceil(cards.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })
  useEffect(() => {
    virtualizer.measure()
  }, [rowHeight, virtualizer])

  // New result set: back to the top.
  const firstId = cards[0]?.id
  useEffect(() => {
    // scrollTo returns a Promise in newer browsers; an effect must not return it.
    void scrollRef.current?.scrollTo({ top: 0 })
  }, [firstId])

  const rows = virtualizer.getVirtualItems()
  const lastRow = rows[rows.length - 1]?.index ?? 0
  useEffect(() => {
    if (hasMore && lastRow >= rowCount - 3) loadMore()
  }, [hasMore, lastRow, rowCount, loadMore])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" style={{ padding: GAP }}>
      <div role="list" aria-label="Cards" className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {rows.map((row) => (
          <div
            key={row.key}
            className="absolute left-0 top-0 grid w-full"
            style={{
              transform: `translateY(${row.start}px)`,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: GAP,
            }}
          >
            {cards.slice(row.index * columns, (row.index + 1) * columns).map((card) => (
              <div role="listitem" key={card.id}>
                <CardTile card={card} count={counts[card.id] ?? 0} onOpen={onOpen} onAdd={onAdd} onRemove={onRemove} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {isLoadingMore && <p className="py-3 text-center text-sm text-slate-400">Loading more…</p>}
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3 p-3">
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} className="skeleton aspect-[5/7] rounded-lg bg-slate-800" />
      ))}
    </div>
  )
}
