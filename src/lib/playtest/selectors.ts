// Pure read helpers over GameState.

import { isBasicPokemon } from '../types'
import type { CardInstance, GameState, PokemonInPlay, Zone } from './types'

/** Zones that are plain ordered piles of cards. */
export const PILE_ZONES = ['deck', 'hand', 'prizes', 'discard', 'lostZone'] as const
export type PileZone = (typeof PILE_ZONES)[number]

export const ZONES: readonly Zone[] = [...PILE_ZONES, 'stadium', 'active', 'bench']

export const isPileZone = (zone: Zone): zone is PileZone => (PILE_ZONES as readonly Zone[]).includes(zone)

export type CardLocation = {
  zone: Zone
  /** 'zone' for a loose card; 'stack' or 'attached' for a card that is part of a Pokémon in play. */
  where: 'zone' | 'stack' | 'attached'
  /** Set when the card is part of a Pokémon in play. */
  slotId?: string
  card: CardInstance
}

/** Active first, then the Bench in order. */
export function allPokemonInPlay(state: GameState): PokemonInPlay[] {
  const { active, bench } = state.player
  return active ? [active, ...bench] : bench
}

/** Where a card currently is, or null for an unknown uid. */
export function locate(state: GameState, uid: string): CardLocation | null {
  const p = state.player
  for (const zone of PILE_ZONES) {
    const card = p[zone].find((c) => c.uid === uid)
    if (card) return { zone, where: 'zone', card }
  }
  if (p.stadium?.uid === uid) return { zone: 'stadium', where: 'zone', card: p.stadium }
  for (const slot of allPokemonInPlay(state)) {
    const zone: Zone = slot === p.active ? 'active' : 'bench'
    const inStack = slot.stack.find((c) => c.uid === uid)
    if (inStack) return { zone, where: 'stack', slotId: slot.id, card: inStack }
    const attached = slot.attached.find((c) => c.uid === uid)
    if (attached) return { zone, where: 'attached', slotId: slot.id, card: attached }
  }
  return null
}

/** Resolves a Pokémon in play from its slot id or from the uid of any card in its stack or attachments. */
export function findInPlay(state: GameState, ref: string): PokemonInPlay | null {
  const all = allPokemonInPlay(state)
  return (
    all.find((slot) => slot.id === ref) ??
    all.find((slot) => slot.stack.some((c) => c.uid === ref) || slot.attached.some((c) => c.uid === ref)) ??
    null
  )
}

/** The visible card of a Pokémon in play. */
export function topCard(slot: PokemonInPlay): CardInstance {
  return slot.stack[slot.stack.length - 1]
}

export function hasBasicInHand(state: GameState): boolean {
  return state.player.hand.some((c) => isBasicPokemon(c.card))
}

/** Cards per pile, plus Pokémon in the Active Spot / on the Bench and 0 or 1 for the Stadium. */
export function zoneCounts(state: GameState): Record<Zone, number> {
  const p = state.player
  return {
    deck: p.deck.length,
    hand: p.hand.length,
    prizes: p.prizes.length,
    discard: p.discard.length,
    lostZone: p.lostZone.length,
    stadium: p.stadium ? 1 : 0,
    active: p.active ? 1 : 0,
    bench: p.bench.length,
  }
}
