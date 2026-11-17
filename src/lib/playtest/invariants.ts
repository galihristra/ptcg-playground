// The conservation invariant: no action may create, lose or duplicate a card.

import { PILE_ZONES, allPokemonInPlay } from './selectors'
import type { GameState } from './types'

/** Every uid currently in the game: all piles, the Stadium, and every stack and attachment. */
export function collectUids(state: GameState): string[] {
  const p = state.player
  const out: string[] = []
  for (const zone of PILE_ZONES) for (const c of p[zone]) out.push(c.uid)
  if (p.stadium) out.push(p.stadium.uid)
  for (const slot of allPokemonInPlay(state)) {
    for (const c of slot.stack) out.push(c.uid)
    for (const c of slot.attached) out.push(c.uid)
  }
  return out
}

/** Throws when the cards in play are not exactly `initialUids`. For tests and dev-mode checks. */
export function assertConservation(state: GameState): void {
  const now = collectUids(state).sort()
  const initial = state.initialUids.slice().sort()
  if (now.length !== initial.length || now.some((uid, i) => uid !== initial[i])) {
    const missing = initial.filter((uid) => !now.includes(uid))
    const extra = now.filter((uid, i) => !initial.includes(uid) || now.indexOf(uid) !== i)
    throw new Error(`Card conservation broken. Missing: [${missing.join(', ')}]. Extra or duplicated: [${extra.join(', ')}].`)
  }
}
