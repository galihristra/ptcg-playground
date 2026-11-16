// App-owned card types. Nothing outside lib/cards.ts should depend on SDK types.

export type Category = 'Pokemon' | 'Trainer' | 'Energy'

export interface CardBrief {
  id: string
  localId: string
  name: string
  /** Base image URL without quality/extension; undefined when TCGdex has no scan yet. */
  image?: string
}

export interface CardAttack {
  name: string
  cost?: string[]
  damage?: string | number
  effect?: string
}

export interface CardAbility {
  name: string
  type?: string
  effect?: string
}

export interface Card extends CardBrief {
  category: Category
  set: { id: string; name: string }
  rarity?: string
  hp?: number
  types?: string[]
  /** TCGdex stage. Current Standard cards are 'Basic', 'Stage1' or 'Stage2' (no space); Mega Evolution Pokémon ex use their real stage, not 'MEGA'. */
  stage?: string
  /** Name of the Pokémon this evolves from (TCGdex). Missing on Basics, on decks saved before this field existed, and on some newer cards where TCGdex has no data yet. */
  evolveFrom?: string
  /** 'ex' for Pokémon ex. Not fully reliable in TCGdex (some ex cards carry 'EX'), so use isPokemonEx(). */
  suffix?: string
  regulationMark?: string
  /** TCGdex uses 'Normal' for basic Energy and 'Special' for special Energy. */
  energyType?: string
  /** TCGdex values for current Standard: 'Item', 'Supporter', 'Stadium', 'Tool'. ACE SPEC cards keep their real type here and are marked by rarity. */
  trainerType?: string
  effect?: string
  attacks?: CardAttack[]
  abilities?: CardAbility[]
  retreat?: number
  illustrator?: string
}

export interface CardFilters {
  name?: string
  category?: Category
  type?: string
  stage?: string
  hpMin?: number
  hpMax?: number
  setId?: string
  rarity?: string
}

export type ImageQuality = 'low' | 'high'

export function imageUrl(card: CardBrief, quality: ImageQuality = 'low'): string | undefined {
  return card.image ? `${card.image}/${quality}.webp` : undefined
}

export function isBasicEnergy(card: Pick<Card, 'category' | 'energyType'>): boolean {
  return card.category === 'Energy' && (card.energyType === 'Normal' || card.energyType === 'Basic')
}

export function isBasicPokemon(card: Pick<Card, 'category' | 'stage'>): boolean {
  return card.category === 'Pokemon' && card.stage === 'Basic'
}

/**
 * Pokémon ex (lowercase, the current Standard mechanic). The printed name always ends in " ex";
 * the suffix is checked too, but TCGdex has ex cards whose suffix is wrongly 'EX', so the name wins.
 */
export function isPokemonEx(card: Pick<Card, 'category' | 'name' | 'suffix'>): boolean {
  return card.category === 'Pokemon' && (card.suffix === 'ex' || card.name.endsWith(' ex'))
}

/** Mega Evolution Pokémon ex: an ex whose name starts with "Mega ". Its stage is still Basic/Stage1/Stage2. */
export function isMegaEx(card: Pick<Card, 'category' | 'name' | 'suffix'>): boolean {
  return isPokemonEx(card) && card.name.startsWith('Mega ')
}

/** Prize cards the opponent takes when this Pokémon is Knocked Out: 3 for a Mega Evolution ex, 2 for an ex, otherwise 1. */
export function prizeValue(card: Pick<Card, 'category' | 'name' | 'suffix'>): 1 | 2 | 3 {
  if (isMegaEx(card)) return 3
  return isPokemonEx(card) ? 2 : 1
}
