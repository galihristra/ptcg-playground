import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Card } from '../lib/types'
import type { DeckEntry } from '../lib/validation'

export interface Deck {
  id: string
  name: string
  /** Keyed by card id. Full Card objects are kept so validation works offline. */
  entries: Record<string, DeckEntry>
  updatedAt: number
}

interface DeckState {
  decks: Record<string, Deck>
  activeId: string
  addCard: (card: Card) => void
  removeCard: (cardId: string) => void
  setCount: (cardId: string, count: number) => void
  clearDeck: () => void
  renameDeck: (name: string) => void
  duplicateDeck: () => void
  newDeck: () => void
  deleteDeck: () => void
  selectDeck: (id: string) => void
  replaceEntries: (entries: DeckEntry[], name?: string) => void
  /** Swaps in fresher snapshots of cards already saved, in every deck. Counts and deck order are untouched. */
  refreshCards: (cards: Card[]) => void
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)

function emptyDeck(name = 'New deck'): Deck {
  return { id: newId(), name, entries: {}, updatedAt: Date.now() }
}

function initial(): Pick<DeckState, 'decks' | 'activeId'> {
  const deck = emptyDeck('My deck')
  return { decks: { [deck.id]: deck }, activeId: deck.id }
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set) => {
      /** Applies `fn` to the active deck's entries. */
      const editEntries = (fn: (entries: Record<string, DeckEntry>) => Record<string, DeckEntry>) =>
        set((s) => {
          const deck = s.decks[s.activeId]
          if (!deck) return s
          return { decks: { ...s.decks, [deck.id]: { ...deck, entries: fn(deck.entries), updatedAt: Date.now() } } }
        })

      return {
        ...initial(),
        addCard: (card) =>
          editEntries((entries) => ({ ...entries, [card.id]: { card, count: (entries[card.id]?.count ?? 0) + 1 } })),
        removeCard: (cardId) =>
          editEntries((entries) => {
            const current = entries[cardId]
            if (!current) return entries
            const { [cardId]: _removed, ...rest } = entries
            return current.count > 1 ? { ...rest, [cardId]: { ...current, count: current.count - 1 } } : rest
          }),
        setCount: (cardId, count) =>
          editEntries((entries) => {
            const current = entries[cardId]
            if (!current) return entries
            const { [cardId]: _removed, ...rest } = entries
            return count > 0 ? { ...rest, [cardId]: { ...current, count } } : rest
          }),
        clearDeck: () => editEntries(() => ({})),
        renameDeck: (name) =>
          set((s) => ({ decks: { ...s.decks, [s.activeId]: { ...s.decks[s.activeId], name, updatedAt: Date.now() } } })),
        duplicateDeck: () =>
          set((s) => {
            const source = s.decks[s.activeId]
            const copy: Deck = { ...source, id: newId(), name: `${source.name} (copy)`, updatedAt: Date.now() }
            return { decks: { ...s.decks, [copy.id]: copy }, activeId: copy.id }
          }),
        newDeck: () =>
          set((s) => {
            const deck = emptyDeck()
            return { decks: { ...s.decks, [deck.id]: deck }, activeId: deck.id }
          }),
        deleteDeck: () =>
          set((s) => {
            const { [s.activeId]: _removed, ...rest } = s.decks
            const remaining = Object.values(rest).sort((a, b) => b.updatedAt - a.updatedAt)
            if (remaining.length === 0) return initial()
            return { decks: rest, activeId: remaining[0].id }
          }),
        selectDeck: (id) => set((s) => (s.decks[id] ? { activeId: id } : s)),
        replaceEntries: (list, name) =>
          set((s) => {
            const deck = s.decks[s.activeId]
            const entries = Object.fromEntries(list.filter((e) => e.count > 0).map((e) => [e.card.id, e]))
            return { decks: { ...s.decks, [deck.id]: { ...deck, name: name ?? deck.name, entries, updatedAt: Date.now() } } }
          }),
        refreshCards: (cards) =>
          set((s) => {
            const fresh = new Map(cards.map((c) => [c.id, c]))
            let changed = false
            const decks = Object.fromEntries(
              Object.values(s.decks).map((deck) => {
                if (!Object.keys(deck.entries).some((id) => fresh.has(id))) return [deck.id, deck]
                changed = true
                const entries = Object.fromEntries(
                  Object.entries(deck.entries).map(([id, e]) => [id, fresh.has(id) ? { ...e, card: fresh.get(id)! } : e]),
                )
                return [deck.id, { ...deck, entries }]
              }),
            )
            return changed ? { decks } : s
          }),
      }
    },
    {
      name: 'poke-deckbuilder:decks',
      version: 1,
      partialize: (s) => ({ decks: s.decks, activeId: s.activeId }),
    },
  ),
)

export function useActiveDeck(): Deck {
  return useDeckStore((s) => s.decks[s.activeId])
}
