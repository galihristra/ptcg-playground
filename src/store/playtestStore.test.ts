import { beforeEach, describe, expect, it } from 'vitest'
import { engineDeck } from '../lib/testUtils'
import { usePlaytestStore } from './playtestStore'

const DECK = engineDeck()
const store = () => usePlaytestStore.getState()

describe('playtestStore', () => {
  beforeEach(() => store().exit())

  it('starts with no game, and dispatch does nothing without one', () => {
    expect(store().game).toBeNull()
    store().dispatch({ type: 'DRAW', count: 1 })
    expect(store().game).toBeNull()
  })

  it('start creates a setup-phase game with the opening hand drawn', () => {
    store().start(DECK, 5)
    expect(store().game).toMatchObject({ phase: 'setup', turn: 0 })
    expect(store().game?.player.hand).toHaveLength(7)
  })

  it('is reproducible with a seed and random without one', () => {
    store().start(DECK, 5)
    const first = store().game
    store().start(DECK, 5)
    expect(store().game).toEqual(first)
    store().start(DECK)
    const a = store().game?.rng
    store().start(DECK)
    expect(store().game?.rng).not.toBe(a)
  })

  it('dispatch runs the reducer', () => {
    store().start(DECK, 5)
    store().dispatch({ type: 'START_GAME', goingFirst: true })
    store().dispatch({ type: 'DRAW', count: 2 })
    expect(store().game).toMatchObject({ phase: 'playing', turn: 1 })
    expect(store().game?.player.hand).toHaveLength(9)
  })

  it('keeps the same state object for a no-op action', () => {
    store().start(DECK, 5)
    const before = store()
    store().dispatch({ type: 'END_TURN' })
    expect(store()).toBe(before)
  })

  it('exit clears the game', () => {
    store().start(DECK, 5)
    store().exit()
    expect(store().game).toBeNull()
  })
})
