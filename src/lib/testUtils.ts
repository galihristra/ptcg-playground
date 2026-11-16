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

export function stage1(name: string, from: string, over: Partial<Card> = {}): Card {
  return pokemon(name, { stage: 'Stage1', evolveFrom: from, hp: 100, ...over })
}

export function stage2(name: string, from: string, over: Partial<Card> = {}): Card {
  return pokemon(name, { stage: 'Stage2', evolveFrom: from, hp: 150, ...over })
}

export function supporter(name: string, over: Partial<Card> = {}): Card {
  return trainer(name, { trainerType: 'Supporter', ...over })
}

export function stadium(name: string, over: Partial<Card> = {}): Card {
  return trainer(name, { trainerType: 'Stadium', ...over })
}

export function tool(name: string, over: Partial<Card> = {}): Card {
  return trainer(name, { trainerType: 'Tool', ...over })
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

/**
 * A 60-card deck with known counts for playtest engine tests:
 * 8 Basics, 4 Stage 1, 2 Stage 2, 4 Supporters, 6 Items, 2 Stadiums, 2 Tools, 32 basic Energy.
 * The evolution line is Seedling -> Sprout -> Bloom; Pebble has no evolution.
 */
export function engineDeck(): DeckEntry[] {
  return [
    entry(pokemon('Seedling'), 4),
    entry(pokemon('Pebble'), 4),
    entry(stage1('Sprout', 'Seedling'), 4),
    entry(stage2('Bloom', 'Sprout'), 2),
    entry(supporter('Research'), 4),
    entry(trainer('Ball'), 4),
    entry(trainer('Switch'), 2),
    entry(stadium('Arena'), 2),
    entry(tool('Cape'), 2),
    entry(basicEnergy(), 32),
  ]
}
