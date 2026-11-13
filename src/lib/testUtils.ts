import type { Card } from './types'
import type { DeckEntry } from './validation'

let seq = 0

export function pokemon(name: string, over: Partial<Card> = {}): Card {
  const n = String(++seq).padStart(3, '0')
  return {
    id: `sv05-${n}`,
    localId: n,
    name,
    category: 'Pokemon',
    stage: 'Basic',
    hp: 70,
    types: ['Colorless'],
    regulationMark: 'H',
    set: { id: 'sv05', name: 'Temporal Forces' },
    ...over,
  }
}

export function trainer(name: string, over: Partial<Card> = {}): Card {
  return pokemon(name, { category: 'Trainer', stage: undefined, hp: undefined, types: undefined, trainerType: 'Item', ...over })
}

export function basicEnergy(name = 'Grass Energy', over: Partial<Card> = {}): Card {
  return pokemon(name, {
    id: 'sve-001',
    localId: '001',
    category: 'Energy',
    energyType: 'Normal',
    stage: undefined,
    hp: undefined,
    types: undefined,
    regulationMark: undefined,
    set: { id: 'sve', name: 'Scarlet & Violet Energy' },
    ...over,
  })
}

export const entry = (card: Card, count: number): DeckEntry => ({ card, count })

/** A legal 60-card deck: 4 each of 10 Basic Pokémon + 20 basic Energy. */
export function legalDeck(): DeckEntry[] {
  const mons = Array.from({ length: 10 }, (_, i) => entry(pokemon(`Mon ${i}`), 4))
  return [...mons, entry(basicEnergy(), 20)]
}
