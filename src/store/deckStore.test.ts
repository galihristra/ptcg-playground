import { beforeEach, describe, expect, it } from 'vitest'
import { pokemon } from '../lib/testUtils'
import { useDeckStore } from './deckStore'

const active = () => {
  const s = useDeckStore.getState()
  return s.decks[s.activeId]
}

describe('deckStore', () => {
  beforeEach(() => {
    localStorage.clear()
    const s = useDeckStore.getState()
    for (const id of Object.keys(s.decks)) {
      s.selectDeck(id)
      useDeckStore.getState().deleteDeck()
    }
  })

  it('adds, counts and removes cards', () => {
    const card = pokemon('Pikachu')
    const { addCard, removeCard } = useDeckStore.getState()
    addCard(card)
    addCard(card)
    expect(active().entries[card.id].count).toBe(2)
    removeCard(card.id)
    expect(active().entries[card.id].count).toBe(1)
    removeCard(card.id)
    expect(active().entries[card.id]).toBeUndefined()
  })

  it('persists decks to localStorage', () => {
    const card = pokemon('Eevee')
    useDeckStore.getState().addCard(card)
    const saved = JSON.parse(localStorage.getItem('poke-deckbuilder:decks')!)
    expect(saved.state.decks[saved.state.activeId].entries[card.id].card.name).toBe('Eevee')
  })

  it('duplicates into an independent deck and deletes back', () => {
    const card = pokemon('Snorlax')
    useDeckStore.getState().addCard(card)
    const originalId = active().id
    useDeckStore.getState().duplicateDeck()
    expect(active().id).not.toBe(originalId)
    expect(active().name).toContain('(copy)')
    useDeckStore.getState().clearDeck()
    expect(useDeckStore.getState().decks[originalId].entries[card.id].count).toBe(1)
    useDeckStore.getState().deleteDeck()
    expect(active().id).toBe(originalId)
  })

  it('refreshCards swaps card snapshots in every deck without touching counts', () => {
    const basic = pokemon('Seedling')
    const stale = pokemon('Sprout', { stage: 'Stage1' })
    const fresh = { ...stale, evolveFrom: 'Seedling' }
    useDeckStore.getState().addCard(basic)
    useDeckStore.getState().addCard(stale)
    useDeckStore.getState().addCard(stale)
    const firstId = active().id
    const before = active()
    useDeckStore.getState().duplicateDeck()

    useDeckStore.getState().refreshCards([fresh])

    const { decks } = useDeckStore.getState()
    for (const deck of Object.values(decks)) {
      expect(deck.entries[stale.id]).toEqual({ card: fresh, count: 2 })
      expect(deck.entries[basic.id].card).toBe(basic)
    }
    expect(decks[firstId].updatedAt).toBe(before.updatedAt)
  })

  it('refreshCards is a no-op for cards no deck contains', () => {
    useDeckStore.getState().addCard(pokemon('Seedling'))
    const before = useDeckStore.getState().decks
    useDeckStore.getState().refreshCards([pokemon('Stranger')])
    expect(useDeckStore.getState().decks).toBe(before)
  })
})
