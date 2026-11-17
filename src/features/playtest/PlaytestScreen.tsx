import { useMemo, useState, type ReactNode } from 'react'
import { findInPlay, locate, topCard } from '../../lib/playtest/selectors'
import type { Action, CardInstance, PokemonInPlay } from '../../lib/playtest/types'
import { computeWarnings } from '../../lib/playtest/warnings'
import { imageUrl, type Card } from '../../lib/types'
import { validateDeck } from '../../lib/validation'
import { useActiveDeck } from '../../store/deckStore'
import { usePlaytestGame, usePlaytestStore } from '../../store/playtestStore'
import { useUiStore } from '../../store/uiStore'
import { useValidationContext } from '../useStandardData'
import { actionsFor, type CardAction } from './cardActions'

type Pile = 'deck' | 'discard' | 'lostZone'
type Pending = { kind: 'EVOLVE' | 'ATTACH'; uid: string }

const PILE_TITLE: Record<Pile, string> = { deck: 'Deck (top card first)', discard: 'Discard pile', lostZone: 'Lost Zone' }

/** Marker actions keep the Pokémon selected so damage can be added several times in a row. */
const KEEPS_SELECTION: Action['type'][] = ['ADD_DAMAGE', 'SET_CONDITION', 'TOGGLE_POISON', 'TOGGLE_BURN']

const btn = 'rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-40'
const primaryBtn = 'rounded-md bg-amber-400 px-2.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40'
const dangerBtn = 'rounded-md bg-red-900/70 px-2.5 py-1.5 text-xs font-medium text-red-100 hover:bg-red-800'
const toneClass = (tone: CardAction['tone']) => (tone === 'primary' ? primaryBtn : tone === 'danger' ? dangerBtn : btn)

function subtitle(card: Card): string {
  if (card.category === 'Pokemon') return [card.stage, card.hp ? `${card.hp} HP` : ''].filter(Boolean).join(' · ')
  if (card.category === 'Trainer') return card.trainerType ?? 'Trainer'
  return 'Energy'
}

/** The card image over a plain text face, which stays visible until the image has loaded (or if there is none). */
function CardFace({ card }: { card: Card }) {
  const [loaded, setLoaded] = useState(false)
  const [broken, setBroken] = useState(false)
  const src = broken ? undefined : imageUrl(card, 'low')
  return (
    <span className="relative block aspect-[5/7] w-full overflow-hidden rounded-lg bg-slate-800">
      <span className="flex h-full flex-col items-center justify-center gap-1 p-1 text-center">
        <span className="text-xs font-semibold leading-tight text-slate-100">{card.name}</span>
        <span className="text-[10px] leading-tight text-slate-400">{subtitle(card)}</span>
      </span>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${loaded ? '' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  )
}

interface CardButtonProps {
  instance: CardInstance
  selected: boolean
  width: string
  onSelect: (uid: string) => void
}

function CardButton({ instance, selected, width, onSelect }: CardButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${instance.card.name}, ${subtitle(instance.card)}`}
      onClick={() => onSelect(instance.uid)}
      className={`${width} shrink-0 rounded-lg ring-2 transition ${selected ? 'ring-amber-400' : 'ring-transparent hover:ring-slate-500'}`}
    >
      <CardFace card={instance.card} />
    </button>
  )
}

interface PokemonProps {
  slot: PokemonInPlay
  width: string
  selectedUid: string | null
  /** True while the player is choosing a target for Evolve or Attach. */
  targetable: boolean
  onSelect: (uid: string) => void
  onTarget: (slotId: string) => void
}

function PokemonView({ slot, width, selectedUid, targetable, onSelect, onTarget }: PokemonProps) {
  const top = topCard(slot)
  const hp = top.card.hp
  const conditions = [slot.condition, slot.poisoned ? 'poisoned' : null, slot.burned ? 'burned' : null].filter((c): c is string => c !== null)
  return (
    <div className={`${width} shrink-0`}>
      <button
        type="button"
        aria-pressed={selectedUid === top.uid}
        aria-label={`${top.card.name}${slot.damage ? `, ${slot.damage} damage` : ''}${conditions.length ? `, ${conditions.join(', ')}` : ''}`}
        onClick={() => (targetable ? onTarget(slot.id) : onSelect(top.uid))}
        className={`relative block w-full rounded-lg ring-2 transition ${targetable ? 'ring-emerald-400' : selectedUid === top.uid ? 'ring-amber-400' : 'ring-transparent hover:ring-slate-500'}`}
      >
        <CardFace card={top.card} />
        {slot.damage > 0 && <span className="absolute right-1 top-1 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white shadow">{slot.damage}</span>}
        {conditions.length > 0 && (
          <span className="absolute inset-x-1 bottom-1 flex flex-wrap gap-0.5">
            {conditions.map((c) => (
              <span key={c} className="rounded bg-fuchsia-700 px-1 text-[10px] font-semibold capitalize text-white">
                {c}
              </span>
            ))}
          </span>
        )}
      </button>
      <p className="mt-1 truncate text-[11px] text-slate-400">
        {hp ? `${Math.max(0, hp - slot.damage)} / ${hp} HP` : top.card.name}
        {slot.stack.length > 1 ? ` · on ${slot.stack[slot.stack.length - 2].card.name}` : ''}
      </p>
      {slot.attached.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {slot.attached.map((c) => (
            <li key={c.uid}>
              <button
                type="button"
                aria-pressed={selectedUid === c.uid}
                onClick={() => onSelect(c.uid)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${selectedUid === c.uid ? 'bg-amber-400 text-slate-950' : c.card.category === 'Energy' ? 'bg-emerald-900 text-emerald-100' : 'bg-sky-900 text-sky-100'}`}
              >
                {c.card.name.replace(/ Energy$/, '')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Zone({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-xl border border-slate-800 bg-slate-900/50 p-2 ${className}`}>
      <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

export default function PlaytestScreen() {
  const game = usePlaytestGame()
  const deck = useActiveDeck()
  const ctx = useValidationContext()
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [openPile, setOpenPile] = useState<Pile | null>(null)

  // Derived with useMemo, not inside a store selector: a selector returning a new array re-renders forever.
  const warnings = useMemo(() => (game ? computeWarnings(game) : []), [game])
  const validation = useMemo(() => (game ? validateDeck(game.deckEntries, ctx) : null), [game, ctx])

  const exit = () => {
    usePlaytestStore.getState().exit()
    useUiStore.getState().setView('builder')
  }

  if (!game || !validation) {
    return (
      <div className="p-6 text-sm text-slate-300">
        <p>No playtest in progress.</p>
        <button type="button" className={`${btn} mt-3`} onClick={exit}>
          Back to deck
        </button>
      </div>
    )
  }

  const { player } = game
  const dispatch = (action: Action) => {
    usePlaytestStore.getState().dispatch(action)
    setPending(null)
    if (!KEEPS_SELECTION.includes(action.type)) setSelectedUid(null)
  }
  const select = (uid: string) => {
    setPending(null)
    setSelectedUid((current) => (current === uid ? null : uid))
  }
  const target = (slotId: string) => {
    if (pending) dispatch({ type: pending.kind, uid: pending.uid, target: slotId })
  }
  const restart = () => {
    if (game.phase === 'setup' || window.confirm('Start over with a freshly shuffled deck?')) {
      setOpenPile(null)
      dispatch({ type: 'RESET' })
    }
  }

  const selected = selectedUid ? locate(game, selectedUid) : null
  const actions = selected ? actionsFor(game, selected.card.uid) : []
  // While picking a target, every Pokémon is a target except the one the card is already part of.
  const isTargetable = (slot: PokemonInPlay) => pending !== null && findInPlay(game, pending.uid)?.id !== slot.id
  const pokemonProps = { selectedUid, onSelect: select, onTarget: target }
  const lastDiscard = player.discard[player.discard.length - 1]

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
        <h1 className="mr-auto min-w-0 truncate text-base font-semibold">
          Playtest <span className="font-normal text-slate-500">· {deck.name || 'Untitled'}</span>
        </h1>
        <span className="text-xs text-slate-400">
          {validation.total} cards · {validation.valid ? 'Standard legal' : `${validation.errors.length} deck issue${validation.errors.length === 1 ? '' : 's'}`}
        </span>
        <button type="button" className={btn} onClick={restart}>
          Restart
        </button>
        <button type="button" className={btn} onClick={exit}>
          Back to deck
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2" aria-live="polite">
        {game.phase === 'setup' ? (
          <>
            <p className="mr-auto text-sm">
              <span className="font-semibold">Setup.</span> Put a Basic Pokémon in the Active Spot, bench any others, then start.
              {game.mulligans > 0 && <span className="text-slate-400"> Mulligans: {game.mulligans}.</span>}
            </p>
            <button type="button" className={btn} onClick={() => dispatch({ type: 'MULLIGAN' })}>
              Mulligan
            </button>
            <button type="button" className={primaryBtn} onClick={() => dispatch({ type: 'START_GAME', goingFirst: true })}>
              Start, going first
            </button>
            <button type="button" className={primaryBtn} onClick={() => dispatch({ type: 'START_GAME', goingFirst: false })}>
              Start, going second
            </button>
          </>
        ) : (
          <>
            <p className="mr-auto text-sm">
              <span className="font-semibold">Turn {game.turn}</span>
              <span className="text-slate-400"> · going {game.goingFirst ? 'first' : 'second'}</span>
            </p>
            <button type="button" className={primaryBtn} disabled={player.deck.length === 0} onClick={() => dispatch({ type: 'DRAW', count: 1 })}>
              Draw
            </button>
            <button type="button" className={btn} onClick={() => dispatch({ type: 'FLIP_COIN' })}>
              Flip coin
            </button>
            <button type="button" className={btn} onClick={() => dispatch({ type: 'END_TURN' })}>
              End turn
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-40 lg:pb-28">
        <div className="mx-auto grid max-w-7xl gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Zone title={`Prize cards · ${player.prizes.length}`}>
                <button type="button" className={btn} disabled={player.prizes.length === 0} onClick={() => dispatch({ type: 'TAKE_PRIZE', uid: player.prizes[0].uid })}>
                  Take a Prize
                </button>
              </Zone>
              <Zone title={`Deck · ${player.deck.length}`}>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={btn} onClick={() => dispatch({ type: 'SHUFFLE_DECK' })}>
                    Shuffle
                  </button>
                  <button type="button" className={btn} aria-expanded={openPile === 'deck'} onClick={() => setOpenPile(openPile === 'deck' ? null : 'deck')}>
                    Search
                  </button>
                </div>
              </Zone>
              <Zone title={`Discard · ${player.discard.length}`}>
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" className={btn} disabled={player.discard.length === 0} aria-expanded={openPile === 'discard'} onClick={() => setOpenPile(openPile === 'discard' ? null : 'discard')}>
                    View
                  </button>
                  {player.lostZone.length > 0 && (
                    <button type="button" className={btn} aria-expanded={openPile === 'lostZone'} onClick={() => setOpenPile(openPile === 'lostZone' ? null : 'lostZone')}>
                      Lost Zone · {player.lostZone.length}
                    </button>
                  )}
                  {lastDiscard && <span className="min-w-0 truncate text-[11px] text-slate-400">Top: {lastDiscard.card.name}</span>}
                </div>
              </Zone>
              <Zone title="Stadium">
                {player.stadium ? (
                  <button
                    type="button"
                    aria-pressed={selectedUid === player.stadium.uid}
                    onClick={() => select(player.stadium!.uid)}
                    className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-medium ${selectedUid === player.stadium.uid ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`}
                  >
                    {player.stadium.card.name}
                  </button>
                ) : (
                  <p className="py-1.5 text-xs text-slate-500">None in play</p>
                )}
              </Zone>
            </div>

            {openPile && (
              <Zone title={`${PILE_TITLE[openPile]} · ${player[openPile].length}`}>
                {openPile === 'deck' && <p className="mb-2 text-xs text-slate-400">Pick a card to move it. Shuffle the deck when you are done searching.</p>}
                {player[openPile].length === 0 ? (
                  <p className="text-xs text-slate-500">Empty.</p>
                ) : (
                  <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto p-0.5">
                    {player[openPile].map((c) => (
                      <CardButton key={c.uid} instance={c} width="w-16 sm:w-20" selected={selectedUid === c.uid} onSelect={select} />
                    ))}
                  </div>
                )}
              </Zone>
            )}

            <Zone title="Active Spot">
              <div className="flex justify-center p-0.5">
                {player.active ? (
                  <PokemonView slot={player.active} width="w-28 sm:w-36" targetable={isTargetable(player.active)} {...pokemonProps} />
                ) : (
                  <p className="flex aspect-[5/7] w-28 items-center justify-center rounded-lg border border-dashed border-slate-700 p-2 text-center text-xs text-slate-500 sm:w-36">Empty</p>
                )}
              </div>
            </Zone>
            <Zone title={`Bench · ${player.bench.length}`}>
              {player.bench.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No Benched Pokémon</p>
              ) : (
                <div className="mx-auto flex w-fit max-w-full gap-2 overflow-x-auto p-0.5 pb-1">
                  {player.bench.map((slot) => (
                    <PokemonView key={slot.id} slot={slot} width="w-20 sm:w-24" targetable={isTargetable(slot)} {...pokemonProps} />
                  ))}
                </div>
              )}
            </Zone>

            <Zone title={`Hand · ${player.hand.length}`}>
              {player.hand.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">No cards in hand</p>
              ) : (
                <div className="flex flex-wrap gap-2 p-0.5">
                  {player.hand.map((c) => (
                    <CardButton key={c.uid} instance={c} width="w-20 sm:w-24" selected={selectedUid === c.uid} onSelect={select} />
                  ))}
                </div>
              )}
            </Zone>
          </div>

          <div className="space-y-3">
            <Zone title={`Warnings · ${warnings.length}`}>
              {warnings.length === 0 ? (
                <p className="text-xs text-slate-500">Nothing unusual.</p>
              ) : (
                <ul className="space-y-1 text-xs text-amber-300" aria-live="polite">
                  {warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`} className="flex gap-1.5">
                      <span aria-hidden>!</span>
                      <span>{w.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Zone>
            <Zone title="Log">
              <ol className="max-h-80 space-y-1 overflow-y-auto text-xs text-slate-300">
                {game.log
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li key={entry.n} className="flex gap-2">
                      <span className="w-6 shrink-0 text-right tabular-nums text-slate-600">{entry.n}</span>
                      <span>{entry.text}</span>
                    </li>
                  ))}
              </ol>
            </Zone>
          </div>
        </div>
      </div>

      {selected && (
        <div role="region" aria-label="Card actions" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5">
            <p className="mr-2 min-w-0 text-sm">
              <span className="font-semibold">{selected.card.card.name}</span>
              <span className="text-slate-400"> · {subtitle(selected.card.card)}</span>
            </p>
            {pending ? (
              <>
                <p className="text-sm text-emerald-300">{pending.kind === 'EVOLVE' ? 'Choose the Pokémon to evolve.' : 'Choose the Pokémon to attach it to.'}</p>
                <button type="button" className={btn} onClick={() => setPending(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={toneClass(action.tone)}
                    onClick={() => ('run' in action ? dispatch(action.run) : setPending({ kind: action.pick, uid: selected.card.uid }))}
                  >
                    {action.label}
                  </button>
                ))}
                <button type="button" className={`${btn} ml-auto`} onClick={() => setSelectedUid(null)}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
