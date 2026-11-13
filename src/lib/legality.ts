import {
  CARD_OVERRIDES,
  STANDARD_MARKS,
  getStandardSet,
  isStandardSet,
} from '../data/standardSets'
import { isBasicEnergy, type Card } from './types'

export interface LegalityContext {
  /**
   * Normalised names of Trainer and Energy cards that have a legal printing in a Standard set.
   * Older printings of these names are legal through the reprint rule.
   */
  reprintNames: ReadonlySet<string>
}

export const EMPTY_LEGALITY: LegalityContext = { reprintNames: new Set() }

export function normalizeName(name: string): string {
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").trim().toLowerCase()
}

export type LegalityReason = 'override' | 'basic-energy' | 'set' | 'reprint' | 'rotated-mark' | 'not-in-standard'

export interface LegalityResult {
  legal: boolean
  reason: LegalityReason
  /** Set-level caveat ("legality may be unverified"), if the card's set has one. */
  note?: string
}

type LegalityCard = Pick<Card, 'id' | 'name' | 'category' | 'energyType' | 'regulationMark'> & {
  set: { id: string }
}

export function checkStandardLegality(card: LegalityCard, ctx: LegalityContext): LegalityResult {
  const note = getStandardSet(card.set.id)?.note

  // 1. Manual per-card override wins.
  if (card.id in CARD_OVERRIDES) return { legal: CARD_OVERRIDES[card.id], reason: 'override', note }

  // 2. Basic Energy is always legal.
  if (isBasicEnergy(card)) return { legal: true, reason: 'basic-energy' }

  // 3. Printed in a Standard set, and not carrying a rotated regulation mark.
  const rotatedMark = card.regulationMark != null && !STANDARD_MARKS.includes(card.regulationMark)
  if (isStandardSet(card.set.id) && !rotatedMark) return { legal: true, reason: 'set', note }

  // 4. Reprint rule: Trainer and Energy only, matched by name. Pokémon are never covered.
  if ((card.category === 'Trainer' || card.category === 'Energy') && ctx.reprintNames.has(normalizeName(card.name))) {
    return { legal: true, reason: 'reprint' }
  }

  // 5. Otherwise not legal.
  return { legal: false, reason: isStandardSet(card.set.id) ? 'rotated-mark' : 'not-in-standard' }
}

export function isStandardLegal(card: LegalityCard, ctx: LegalityContext): boolean {
  return checkStandardLegality(card, ctx).legal
}

export function buildReprintNames(cards: Iterable<{ name: string }>): Set<string> {
  const names = new Set<string>()
  for (const c of cards) names.add(normalizeName(c.name))
  return names
}
