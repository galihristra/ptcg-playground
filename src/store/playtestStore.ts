import { create } from 'zustand'
import { reduce } from '../lib/playtest/reducer'
import { randomSeed } from '../lib/playtest/rng'
import { createGame } from '../lib/playtest/setup'
import type { Action, GameState } from '../lib/playtest/types'
import type { DeckEntry } from '../lib/validation'

interface PlaytestState {
  /** The game in progress, or null when no playtest is open. Not persisted: decks persist, games don't. */
  game: GameState | null
  /** Starts a fresh game from a deck. The seed is only passed by tests. */
  start: (entries: DeckEntry[], seed?: number) => void
  dispatch: (action: Action) => void
  exit: () => void
}

export const usePlaytestStore = create<PlaytestState>((set) => ({
  game: null,
  start: (entries, seed) => set({ game: createGame(entries, seed ?? randomSeed()) }),
  dispatch: (action) =>
    set((s) => {
      if (!s.game) return s
      const game = reduce(s.game, action)
      // The reducer returns the same reference for a no-op, so subscribers don't re-render.
      return game === s.game ? s : { game }
    }),
  exit: () => set({ game: null }),
}))

/** The current game. Components read the game through this hook so undo/redo can wrap the store later. */
export function usePlaytestGame(): GameState | null {
  return usePlaytestStore((s) => s.game)
}
