// Small immutable building blocks shared by the reducer's handlers.

import { isPileZone, locate, type CardLocation } from '../selectors'
import type { CardInstance, GameState, PlayerState, PokemonInPlay, Zone } from '../types'

export const ZONE_LABEL: Record<Zone, string> = {
  deck: 'the deck',
  hand: 'the hand',
  prizes: 'the Prize cards',
  discard: 'the discard pile',
  lostZone: 'the Lost Zone',
  stadium: 'the Stadium spot',
  active: 'the Active Spot',
  bench: 'the Bench',
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function appendLog(state: GameState, text: string): GameState {
  const last = state.log[state.log.length - 1]
  return { ...state, log: [...state.log, { n: (last?.n ?? 0) + 1, text }] }
}

export function withPlayer(state: GameState, patch: Partial<PlayerState>): GameState {
  return { ...state, player: { ...state.player, ...patch } }
}

/** Applies `fn` to the Pokémon in play with this slot id. Returning null removes the slot. */
export function updateSlot(state: GameState, slotId: string, fn: (slot: PokemonInPlay) => PokemonInPlay | null): GameState {
  const { active, bench } = state.player
  if (active?.id === slotId) return withPlayer(state, { active: fn(active) })
  if (!bench.some((s) => s.id === slotId)) return state
  const next: PokemonInPlay[] = []
  for (const slot of bench) {
    const updated = slot.id === slotId ? fn(slot) : slot
    if (updated) next.push(updated)
  }
  return withPlayer(state, { bench: next })
}

export type Taken = {
  state: GameState
  card: CardInstance
  from: CardLocation
  /** Side effects worth logging, e.g. attachments that were discarded. */
  notes: string[]
}

/**
 * Removes a card from wherever it is. Taking the last card of a Pokémon's stack removes the
 * Pokémon and sends its attachments to the discard pile, so nothing is orphaned. A card leaving
 * the Prize cards counts as a Prize taken.
 */
export function takeCard(state: GameState, uid: string): Taken | null {
  const from = locate(state, uid)
  if (!from) return null
  const notes: string[] = []
  let next = state

  if (isPileZone(from.zone)) {
    next = withPlayer(state, { [from.zone]: state.player[from.zone].filter((c) => c.uid !== uid) })
    if (from.zone === 'prizes') next = { ...next, prizesTaken: next.prizesTaken + 1 }
  } else if (from.zone === 'stadium') {
    next = withPlayer(state, { stadium: null })
  } else if (from.slotId) {
    let orphans: CardInstance[] = []
    next = updateSlot(state, from.slotId, (slot) => {
      if (from.where === 'attached') return { ...slot, attached: slot.attached.filter((c) => c.uid !== uid) }
      const stack = slot.stack.filter((c) => c.uid !== uid)
      if (stack.length > 0) return { ...slot, stack }
      orphans = slot.attached
      return null
    })
    if (orphans.length > 0) {
      next = withPlayer(next, { discard: [...next.player.discard, ...orphans] })
      notes.push(`${plural(orphans.length, 'attached card')} went to the discard pile`)
    }
  }
  return { state: next, card: from.card, from, notes }
}

export function newSlot(state: GameState, card: CardInstance): { state: GameState; slot: PokemonInPlay } {
  const slot: PokemonInPlay = {
    id: `p${state.nextSlot}`,
    stack: [card],
    attached: [],
    damage: 0,
    poisoned: false,
    burned: false,
    condition: null,
    enteredPlayOnTurn: state.turn,
    evolvedOnTurn: null,
  }
  return { state: { ...state, nextSlot: state.nextSlot + 1 }, slot }
}

/**
 * Puts a loose card into a zone. `position` only matters for the deck (default 'top'); other piles
 * append. A Stadium already in play is discarded. The caller must check the Active Spot is empty.
 */
export function placeCard(
  state: GameState,
  card: CardInstance,
  to: Zone,
  position: 'top' | 'bottom' = 'top',
): { state: GameState; notes: string[] } {
  const p = state.player
  if (to === 'deck') return { state: withPlayer(state, { deck: position === 'bottom' ? [...p.deck, card] : [card, ...p.deck] }), notes: [] }
  if (isPileZone(to)) return { state: withPlayer(state, { [to]: [...p[to], card] }), notes: [] }
  if (to === 'stadium') {
    if (!p.stadium) return { state: withPlayer(state, { stadium: card }), notes: [] }
    return {
      state: withPlayer(state, { stadium: card, discard: [...p.discard, p.stadium] }),
      notes: [`${p.stadium.card.name} was discarded`],
    }
  }
  const made = newSlot(state, card)
  if (to === 'active') return { state: withPlayer(made.state, { active: made.slot }), notes: [] }
  return { state: withPlayer(made.state, { bench: [...made.state.player.bench, made.slot] }), notes: [] }
}

/** Moves up to `count` cards from the top of the deck to the hand. */
export function drawCards(state: GameState, count: number): { state: GameState; drawn: number } {
  const drawn = Math.min(count, state.player.deck.length)
  if (drawn <= 0) return { state, drawn: 0 }
  const { deck, hand } = state.player
  return { state: withPlayer(state, { deck: deck.slice(drawn), hand: [...hand, ...deck.slice(0, drawn)] }), drawn }
}
