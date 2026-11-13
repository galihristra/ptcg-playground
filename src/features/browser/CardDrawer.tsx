import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { getCard } from '../../lib/cards'
import { checkStandardLegality } from '../../lib/legality'
import { imageUrl } from '../../lib/types'
import { isAceSpec } from '../../lib/validation'
import { useActiveDeck } from '../../store/deckStore'
import { useUiStore } from '../../store/uiStore'
import { useDeckActions } from '../deck/useDeckActions'
import { useValidationContext } from '../useStandardData'

const REASON: Record<string, string> = {
  override: 'manual override',
  'basic-energy': 'basic Energy',
  set: 'printed in a Standard set',
  reprint: 'reprinted in a Standard set',
  'rotated-mark': 'regulation mark has rotated',
  'not-in-standard': 'set is not in Standard',
}

export function CardDrawer() {
  const cardId = useUiStore((s) => s.openCardId)
  const close = () => useUiStore.getState().openCard(null)
  const { data: card, isLoading, error, refetch } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId,
  })
  const ctx = useValidationContext()
  const count = useActiveDeck().entries[cardId ?? '']?.count ?? 0
  const { addById, removeById } = useDeckActions()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!cardId) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cardId])

  if (!cardId) return null
  const legality = card ? checkStandardLegality(card, ctx) : undefined
  const image = card && imageUrl(card, 'high')

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={card?.name ?? 'Card details'}>
      <button type="button" aria-label="Close card details" className="absolute inset-0 bg-black/60" onClick={close} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{card?.name ?? (isLoading ? 'Loading…' : 'Card')}</h2>
            {card && (
              <p className="text-sm text-slate-400">
                {card.set.name} · {card.localId}
                {card.rarity ? ` · ${card.rarity}` : ''}
              </p>
            )}
          </div>
          <button ref={closeRef} type="button" onClick={close} className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800" aria-label="Close">
            ✕
          </button>
        </div>

        {isLoading && <div className="skeleton aspect-[5/7] w-full rounded-xl bg-slate-800" />}
        {error && (
          <div role="alert" className="rounded-md border border-red-900 bg-red-950/50 p-3 text-sm">
            Could not load this card from TCGdex.
            <button type="button" className="ml-2 underline" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        )}

        {card && (
          <>
            {image ? (
              <img src={image} alt={card.name} className="mx-auto w-full max-w-xs rounded-xl" />
            ) : (
              <div className="mx-auto flex aspect-[5/7] w-full max-w-xs items-center justify-center rounded-xl bg-slate-800 text-sm text-slate-500">
                No image available yet
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => removeById(card.id)}
                  aria-label="Remove one copy"
                  className="h-9 w-9 rounded-md bg-slate-800 text-lg font-bold hover:bg-slate-700 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-16 text-center text-sm" aria-live="polite">
                  {count} in deck
                </span>
                <button
                  type="button"
                  onClick={() => void addById(card.id)}
                  aria-label="Add one copy"
                  className="h-9 w-9 rounded-md bg-amber-400 text-lg font-bold text-slate-950 hover:bg-amber-300"
                >
                  +
                </button>
              </div>
              {legality && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${legality.legal ? 'bg-emerald-900/60 text-emerald-200' : 'bg-red-900/60 text-red-200'}`}
                >
                  {legality.legal ? 'Standard legal' : 'Not Standard legal'} · {REASON[legality.reason]}
                </span>
              )}
            </div>
            {!ctx.ready && <p className="mt-2 text-xs text-slate-500">Reprint data not loaded yet; Trainer legality may change.</p>}
            {legality?.note && legality.reason === 'set' && (
              <p className="mt-2 rounded-md bg-amber-950/60 p-2 text-xs text-amber-200">Legality may be unverified. {legality.note}</p>
            )}

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-400">Category</dt>
              <dd>
                {card.category === 'Pokemon' ? 'Pokémon' : card.category}
                {card.trainerType ? ` · ${card.trainerType}` : ''}
                {card.energyType ? ` · ${card.energyType === 'Normal' ? 'Basic' : card.energyType}` : ''}
                {isAceSpec(card, ctx.aceSpecNames) ? ' · ACE SPEC' : ''}
              </dd>
              {card.stage && (
                <>
                  <dt className="text-slate-400">Stage</dt>
                  <dd>{card.stage}</dd>
                </>
              )}
              {card.hp != null && (
                <>
                  <dt className="text-slate-400">HP</dt>
                  <dd>{card.hp}</dd>
                </>
              )}
              {card.types?.length ? (
                <>
                  <dt className="text-slate-400">Type</dt>
                  <dd>{card.types.join(', ')}</dd>
                </>
              ) : null}
              {card.retreat != null && (
                <>
                  <dt className="text-slate-400">Retreat</dt>
                  <dd>{card.retreat}</dd>
                </>
              )}
              <dt className="text-slate-400">Regulation mark</dt>
              <dd>{card.regulationMark ?? '—'}</dd>
              <dt className="text-slate-400">Card id</dt>
              <dd className="font-mono text-xs leading-5">{card.id}</dd>
            </dl>

            {card.abilities?.map((a) => (
              <section key={a.name} className="mt-4 text-sm">
                <h3 className="font-semibold text-rose-300">
                  {a.type ?? 'Ability'}: {a.name}
                </h3>
                <p className="text-slate-300">{a.effect}</p>
              </section>
            ))}
            {card.attacks?.map((a) => (
              <section key={a.name} className="mt-4 text-sm">
                <h3 className="flex justify-between gap-2 font-semibold">
                  <span>
                    {a.name}
                    {a.cost?.length ? <span className="ml-2 font-normal text-slate-400">{a.cost.join(' · ')}</span> : null}
                  </span>
                  <span>{a.damage}</span>
                </h3>
                {a.effect && <p className="text-slate-300">{a.effect}</p>}
              </section>
            ))}
            {card.effect && <p className="mt-4 text-sm text-slate-300">{card.effect}</p>}
          </>
        )}
      </aside>
    </div>
  )
}
