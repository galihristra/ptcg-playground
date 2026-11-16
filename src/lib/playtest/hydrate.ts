// Fills in card data that older saved decks are missing. Decks are stored as full Card snapshots,
// so anything saved before `evolveFrom` was mapped has evolved Pokémon without it.
// Network access is injected (same pattern as importResolve.ts) so the engine folder stays pure.

import type { Card } from '../types'
import type { DeckEntry } from '../validation'

export interface RefreshResult {
  /** Same array (same reference) when nothing changed. */
  entries: DeckEntry[]
  /** The cards that were replaced, for writing back to the deck store. */
  refreshed: Card[]
}

/** An evolved Pokémon whose snapshot has no `evolveFrom`. */
export function needsRefresh(card: Card): boolean {
  return card.category === 'Pokemon' && card.stage !== undefined && card.stage !== 'Basic' && card.evolveFrom === undefined
}

/**
 * Re-fetches only the cards that need it. Never throws: a failed fetch (offline) keeps the saved
 * card, and the evolve warning just stays silent for it. TCGdex has no `evolveFrom` for some
 * evolved cards at all, so those are kept as they are too.
 */
export async function refreshCards(entries: DeckEntry[], getCard: (id: string) => Promise<Card>): Promise<RefreshResult> {
  const stale = entries.filter((e) => e.count > 0 && needsRefresh(e.card))
  if (stale.length === 0) return { entries, refreshed: [] }

  const results = await Promise.allSettled(stale.map((e) => getCard(e.card.id)))
  const fresh = new Map<string, Card>()
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.evolveFrom !== undefined) fresh.set(stale[i].card.id, r.value)
  })
  if (fresh.size === 0) return { entries, refreshed: [] }

  return {
    entries: entries.map((e) => (fresh.has(e.card.id) ? { ...e, card: fresh.get(e.card.id)! } : e)),
    refreshed: [...fresh.values()],
  }
}
