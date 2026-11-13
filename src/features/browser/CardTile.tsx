import { memo, useState } from 'react'
import { getStandardSet } from '../../data/standardSets'
import { setIdOfCard } from '../../lib/importResolve'
import { imageUrl, type CardBrief } from '../../lib/types'

interface Props {
  card: CardBrief
  count: number
  onOpen: (id: string) => void
  onAdd: (id: string) => Promise<void>
  onRemove: (id: string) => void
}

export const CardTile = memo(function CardTile({ card, count, onOpen, onAdd, onRemove }: Props) {
  const [busy, setBusy] = useState(false)
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : imageUrl(card, 'low')
  const setId = setIdOfCard(card.id)
  const unverified = !!getStandardSet(setId)?.note

  const add = async () => {
    setBusy(true)
    try {
      await onAdd(card.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(card.id)}
        aria-label={`${card.name}, ${setId} ${card.localId}. Open details`}
        className={`relative block aspect-[5/7] w-full overflow-hidden rounded-lg bg-slate-800 ring-1 transition hover:ring-amber-400 ${count ? 'ring-2 ring-amber-400/80' : 'ring-slate-700'}`}
      >
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
            <span className="text-sm font-medium text-slate-200">{card.name}</span>
            <span className="text-xs text-slate-500">
              {setId} · {card.localId}
            </span>
            <span className="text-[10px] text-slate-600">no image yet</span>
          </span>
        )}
      </button>
      {unverified && (
        <span
          title="Legality may be unverified"
          className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 text-[10px] font-semibold text-slate-950"
        >
          unverified
        </span>
      )}
      <div className="absolute bottom-1 right-1 flex items-center gap-1">
        {count > 0 && (
          <>
            <button
              type="button"
              aria-label={`Remove one ${card.name}`}
              onClick={() => onRemove(card.id)}
              className="h-7 w-7 rounded-full bg-slate-950/90 text-base font-bold text-slate-100 shadow ring-1 ring-slate-600 hover:bg-slate-800"
            >
              −
            </button>
            <span aria-label={`${count} in deck`} className="min-w-6 rounded-full bg-amber-400 px-1.5 text-center text-sm font-bold text-slate-950">
              {count}
            </span>
          </>
        )}
        <button
          type="button"
          aria-label={`Add ${card.name} to deck`}
          disabled={busy}
          onClick={add}
          className="h-7 w-7 rounded-full bg-amber-400 text-base font-bold text-slate-950 shadow hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? '…' : '+'}
        </button>
      </div>
    </div>
  )
})
