import { checkStandardLegality, normalizeName, type LegalityContext } from './legality'
import { isBasicEnergy, type Card } from './types'

export const DECK_SIZE = 60
export const MAX_COPIES = 4
export const ACE_SPEC_RARITY = 'ACE SPEC Rare'

export interface DeckEntry {
  card: Card
  count: number
}

export interface ValidationContext extends LegalityContext {
  /** Normalised names of ACE SPEC cards, so non-"ACE SPEC Rare" printings are caught too. */
  aceSpecNames?: ReadonlySet<string>
}

export type IssueCode =
  | 'deck-size'
  | 'too-many-copies'
  | 'no-basic-pokemon'
  | 'not-standard-legal'
  | 'ace-spec-limit'
  | 'unverified-legality'

export interface Issue {
  code: IssueCode
  message: string
  cardIds?: string[]
}

export interface ValidationResult {
  total: number
  errors: Issue[]
  warnings: Issue[]
  valid: boolean
}

export function isAceSpec(card: Pick<Card, 'name' | 'rarity'>, aceSpecNames?: ReadonlySet<string>): boolean {
  return card.rarity === ACE_SPEC_RARITY || (aceSpecNames?.has(normalizeName(card.name)) ?? false)
}

export function totalCards(entries: Iterable<DeckEntry>): number {
  let n = 0
  for (const e of entries) n += e.count
  return n
}

/** Copies in the deck sharing this card's name, across all printings. */
export function copiesByName(entries: Iterable<DeckEntry>, name: string): number {
  const key = normalizeName(name)
  let n = 0
  for (const e of entries) if (normalizeName(e.card.name) === key) n += e.count
  return n
}

/** Whether one more copy of `card` can be added without breaking the copy limits. */
export function canAddCopy(entries: DeckEntry[], card: Card, ctx?: ValidationContext): boolean {
  if (isBasicEnergy(card)) return true
  if (copiesByName(entries, card.name) >= MAX_COPIES) return false
  if (isAceSpec(card, ctx?.aceSpecNames) && entries.some((e) => isAceSpec(e.card, ctx?.aceSpecNames))) return false
  return true
}

export function validateDeck(entries: DeckEntry[], ctx: ValidationContext): ValidationResult {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const live = entries.filter((e) => e.count > 0)
  const total = totalCards(live)

  if (total !== DECK_SIZE) {
    const diff = DECK_SIZE - total
    errors.push({
      code: 'deck-size',
      message:
        diff > 0
          ? `Deck has ${total} cards — add ${diff} more to reach ${DECK_SIZE}.`
          : `Deck has ${total} cards — remove ${-diff} to get down to ${DECK_SIZE}.`,
    })
  }

  // Max 4 copies by name across printings; basic Energy exempt.
  const byName = new Map<string, { name: string; count: number; ids: string[] }>()
  for (const e of live) {
    if (isBasicEnergy(e.card)) continue
    const key = normalizeName(e.card.name)
    const group = byName.get(key) ?? { name: e.card.name, count: 0, ids: [] }
    group.count += e.count
    group.ids.push(e.card.id)
    byName.set(key, group)
  }
  for (const g of byName.values()) {
    if (g.count > MAX_COPIES) {
      errors.push({
        code: 'too-many-copies',
        message: `${g.count} copies of ${g.name}${g.ids.length > 1 ? ` (across ${g.ids.length} printings)` : ''} — the limit is ${MAX_COPIES}.`,
        cardIds: g.ids,
      })
    }
  }

  if (total > 0 && !live.some((e) => e.card.category === 'Pokemon' && e.card.stage === 'Basic')) {
    errors.push({ code: 'no-basic-pokemon', message: 'Deck needs at least 1 Basic Pokémon.' })
  }

  for (const e of live) {
    const result = checkStandardLegality(e.card, ctx)
    if (!result.legal) {
      errors.push({
        code: 'not-standard-legal',
        message:
          result.reason === 'rotated-mark'
            ? `${e.card.name} (${e.card.set.name} ${e.card.localId}) has rotated regulation mark ${e.card.regulationMark} — not Standard legal.`
            : `${e.card.name} (${e.card.set.name} ${e.card.localId}) is not Standard legal.`,
        cardIds: [e.card.id],
      })
    } else if (result.note && result.reason === 'set') {
      warnings.push({
        code: 'unverified-legality',
        message: `${e.card.name} (${e.card.set.name}): legality may be unverified.`,
        cardIds: [e.card.id],
      })
    }
  }

  const aceSpecs = live.filter((e) => isAceSpec(e.card, ctx.aceSpecNames))
  const aceCount = totalCards(aceSpecs)
  if (aceCount > 1) {
    errors.push({
      code: 'ace-spec-limit',
      message: `${aceCount} ACE SPEC cards (${aceSpecs.map((e) => e.card.name).join(', ')}) — a deck can have only 1.`,
      cardIds: aceSpecs.map((e) => e.card.id),
    })
  }

  return { total, errors, warnings, valid: errors.length === 0 }
}
