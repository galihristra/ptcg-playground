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
  stage?: string
  suffix?: string
  regulationMark?: string
  /** TCGdex uses 'Normal' for basic Energy and 'Special' for special Energy. */
  energyType?: string
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
