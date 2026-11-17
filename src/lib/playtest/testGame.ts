// Test-only helper shared by the playtest engine tests.

import type { DeckEntry } from '../validation'
import { assertConservation } from './invariants'
import { reduce } from './reducer'
import { createGame } from './setup'
import type { Action, GameState } from './types'

const run = (state: GameState, ...actions: Action[]) => actions.reduce(reduce, state)

/**
 * A playing game on turn 2 whose hand holds exactly the named cards (in order), pulled from the
 * hand or deck, so tests can refer to cards by name. Returns the state and the uids of those cards.
 * Share one deck per test file: engineDeck() mints new card ids on every call.
 */
export function handGame(deck: DeckEntry[], ...names: string[]): { state: GameState; hand: string[] } {
  const base = run(createGame(deck, 7), { type: 'START_GAME', goingFirst: true }, { type: 'END_TURN' })
  const pool = [...base.player.hand, ...base.player.deck]
  const picked: string[] = []
  for (const name of names) {
    const card = pool.find((c) => c.card.name === name && !picked.includes(c.uid))
    if (!card) throw new Error(`No free copy of ${name} outside the Prize cards`)
    picked.push(card.uid)
  }
  let state = base
  for (const c of base.player.hand) if (!picked.includes(c.uid)) state = reduce(state, { type: 'MOVE', uid: c.uid, to: 'deck', position: 'bottom' })
  for (const uid of picked) state = reduce(state, { type: 'MOVE', uid, to: 'hand' })
  // Re-order the hand to match `names`.
  state = { ...state, player: { ...state.player, hand: picked.map((uid) => state.player.hand.find((c) => c.uid === uid)!) } }
  assertConservation(state)
  return { state, hand: picked }
}
