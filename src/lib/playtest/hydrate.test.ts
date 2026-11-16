// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { engineDeck, entry, pokemon, stage1 } from '../testUtils'
import type { Card } from '../types'
import { needsRefresh, refreshCards } from './hydrate'

const without = (card: Card): Card => ({ ...card, evolveFrom: undefined })

describe('needsRefresh', () => {
  it('is true only for evolved Pokémon without evolveFrom', () => {
    expect(needsRefresh(without(stage1('Sprout', 'Seedling')))).toBe(true)
    expect(needsRefresh(stage1('Sprout', 'Seedling'))).toBe(false)
    expect(needsRefresh(pokemon('Seedling'))).toBe(false)
    expect(engineDeck().some((e) => needsRefresh(e.card))).toBe(false)
  })
})

describe('refreshCards', () => {
  it('does not fetch and returns the same array when nothing is stale', async () => {
    const entries = engineDeck()
    const getCard = vi.fn()
    const result = await refreshCards(entries, getCard)
    expect(result.entries).toBe(entries)
    expect(result.refreshed).toEqual([])
    expect(getCard).not.toHaveBeenCalled()
  })

  it('re-fetches only stale evolved Pokémon and keeps counts and order', async () => {
    const basic = pokemon('Seedling')
    const fresh = stage1('Sprout', 'Seedling')
    const entries = [entry(basic, 4), entry(without(fresh), 3)]
    const getCard = vi.fn(async (_id: string) => fresh)
    const result = await refreshCards(entries, getCard)
    expect(getCard.mock.calls).toEqual([[fresh.id]])
    expect(result.entries[0]).toBe(entries[0])
    expect(result.entries[1]).toEqual({ card: fresh, count: 3 })
    expect(result.refreshed).toEqual([fresh])
  })

  it('keeps the saved card when the fetch fails', async () => {
    const ok = stage1('Sprout', 'Seedling')
    const failing = stage1('Twig', 'Seedling')
    const entries = [entry(without(ok), 2), entry(without(failing), 2)]
    const getCard = async (id: string) => {
      if (id === failing.id) throw new Error('offline')
      return ok
    }
    const result = await refreshCards(entries, getCard)
    expect(result.entries[0].card.evolveFrom).toBe('Seedling')
    expect(result.entries[1]).toBe(entries[1])
    expect(result.refreshed).toEqual([ok])
  })

  it('returns the same array when every fetch fails or TCGdex has no evolveFrom either', async () => {
    const a = without(stage1('Sprout', 'Seedling'))
    const b = without(stage1('Twig', 'Seedling'))
    const entries = [entry(a, 2), entry(b, 2)]
    const getCard = async (id: string) => {
      if (id === a.id) throw new Error('offline')
      return b
    }
    const result = await refreshCards(entries, getCard)
    expect(result.entries).toBe(entries)
    expect(result.refreshed).toEqual([])
  })
})
