import { useCallback, useMemo } from 'react'
import { getCard } from '../../lib/cards'
import { isBasicEnergy } from '../../lib/types'
import { canAddCopy, copiesByName, MAX_COPIES, type DeckEntry } from '../../lib/validation'
import { useActiveDeck, useDeckStore } from '../../store/deckStore'
import { useUiStore } from '../../store/uiStore'
import { useValidationContext } from '../useStandardData'

export function useDeckEntries(): DeckEntry[] {
  const deck = useActiveDeck()
  return useMemo(() => Object.values(deck.entries), [deck.entries])
}

export function useDeckActions() {
  const ctx = useValidationContext()
  const showToast = useUiStore((s) => s.showToast)

  /** Fetches the card detail (cached) and adds one copy if the copy limits allow it. */
  const addById = useCallback(
    async (cardId: string) => {
      try {
        const card = await getCard(cardId)
        const state = useDeckStore.getState()
        const entries = Object.values(state.decks[state.activeId].entries)
        if (!canAddCopy(entries, card, ctx)) {
          const atLimit = !isBasicEnergy(card) && copiesByName(entries, card.name) >= MAX_COPIES
          showToast(atLimit ? `Already ${MAX_COPIES} copies of ${card.name} in the deck.` : 'A deck can have only 1 ACE SPEC card.')
          return
        }
        state.addCard(card)
      } catch {
        showToast('Could not load that card from TCGdex. Try again.')
      }
    },
    [ctx, showToast],
  )

  const removeById = useCallback((cardId: string) => useDeckStore.getState().removeCard(cardId), [])

  return { addById, removeById }
}
