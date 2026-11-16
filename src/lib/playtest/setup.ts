// Turns a saved deck into a fresh game. Pure: the seed decides the shuffle.

import type { DeckEntry } from '../validation'
import { shuffle } from './rng'
import type { CardInstance, GameState, PlayerState, TurnCounts } from './types'

export const OPENING_HAND_SIZE = 7
export const PRIZE_COUNT = 6

export const emptyTurnCounts = (): TurnCounts => ({ energyAttached: 0, supportersPlayed: 0, retreats: 0, stadiumsPlayed: 0 })

export const emptyPlayer = (): PlayerState => ({
  deck: [],
  hand: [],
  prizes: [],
  discard: [],
  lostZone: [],
  stadium: null,
  active: null,
  bench: [],
})

/**
 * One CardInstance per physical copy, with uid `${card.id}#${n}` (n from 1 per card id).
 * Entries are ordered by card id so the same deck and seed give the same game regardless of the
 * order the entries arrive in. Entries with a count below 1 are skipped.
 */
export function expandDeck(entries: DeckEntry[]): CardInstance[] {
  const sorted = entries.filter((e) => e.count >= 1).sort((a, b) => (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0))
  const seen = new Map<string, number>()
  const out: CardInstance[] = []
  for (const { card, count } of sorted) {
    for (let i = 0; i < Math.floor(count); i++) {
      const n = (seen.get(card.id) ?? 0) + 1
      seen.set(card.id, n)
      out.push({ uid: `${card.id}#${n}`, card })
    }
  }
  return out
}

/** A shuffled deck with the opening hand drawn, in the `setup` phase. Any deck size is allowed. */
export function createGame(entries: DeckEntry[], seed: number): GameState {
  const all = expandDeck(entries)
  const shuffled = shuffle(all, seed)
  const hand = shuffled.cards.slice(0, OPENING_HAND_SIZE)
  const deck = shuffled.cards.slice(OPENING_HAND_SIZE)
  const text =
    hand.length < OPENING_HAND_SIZE
      ? `Shuffled the deck. It has only ${all.length} card${all.length === 1 ? '' : 's'}, so drew ${hand.length} for the opening hand.`
      : `Shuffled the deck (${all.length} cards) and drew ${OPENING_HAND_SIZE}.`
  return {
    phase: 'setup',
    player: { ...emptyPlayer(), deck, hand },
    turn: 0,
    goingFirst: null,
    turnCounts: emptyTurnCounts(),
    mulligans: 0,
    prizesTaken: 0,
    nextSlot: 1,
    rng: shuffled.seed,
    initialUids: all.map((c) => c.uid),
    deckEntries: entries,
    log: [{ n: 1, text }],
  }
}
