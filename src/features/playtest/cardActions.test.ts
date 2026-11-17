// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { reduce } from '../../lib/playtest/reducer'
import { handGame } from '../../lib/playtest/testGame'
import type { Action, GameState } from '../../lib/playtest/types'
import { engineDeck } from '../../lib/testUtils'
import { actionsFor } from './cardActions'

const DECK = engineDeck()
const game = (...names: string[]) => handGame(DECK, ...names)
const run = (state: GameState, ...actions: Action[]) => actions.reduce(reduce, state)
const labels = (state: GameState, uid: string) => actionsFor(state, uid).map((a) => a.label)

describe('actionsFor', () => {
  it('returns nothing for an unknown card', () => {
    expect(actionsFor(game().state, 'nope#1')).toEqual([])
  })

  it('offers the Active Spot for a Basic only while it is empty', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    expect(labels(state, hand[0])).toEqual(['To Active Spot', 'To Bench', 'Discard', 'Top of deck', 'Bottom of deck'])
    const placed = reduce(state, { type: 'MOVE', uid: hand[0], to: 'active' })
    expect(labels(placed, hand[1])).toEqual(['To Bench', 'Discard', 'Top of deck', 'Bottom of deck'])
  })

  it('offers evolving and attaching only when a Pokémon is in play', () => {
    const { state, hand } = game('Seedling', 'Sprout', 'Grass Energy', 'Cape')
    expect(labels(state, hand[1])).not.toContain('Evolve a Pokémon…')
    expect(labels(state, hand[2])).not.toContain('Attach to…')
    const placed = reduce(state, { type: 'MOVE', uid: hand[0], to: 'active' })
    expect(actionsFor(placed, hand[1])[0]).toEqual({ label: 'Evolve a Pokémon…', tone: 'primary', pick: 'EVOLVE' })
    expect(actionsFor(placed, hand[2])[0]).toMatchObject({ label: 'Attach to…', pick: 'ATTACH' })
    expect(actionsFor(placed, hand[3])[0]).toMatchObject({ label: 'Attach to…', pick: 'ATTACH' })
  })

  it('plays Trainers from the hand', () => {
    const { state, hand } = game('Research', 'Arena')
    expect(actionsFor(state, hand[0])[0]).toMatchObject({ label: 'Play', run: { type: 'PLAY_TRAINER', uid: hand[0] } })
    expect(labels(state, hand[1])[0]).toBe('Play Stadium')
  })

  it('offers switching, markers and Knock Out for a Benched Pokémon', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const board = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    expect(actionsFor(board, hand[1])[0]).toMatchObject({ label: 'Switch with Active', run: { type: 'RETREAT', benchTarget: 'p2' } })
    expect(labels(board, hand[0])).toEqual(['+10', '+50', '+100', 'Asleep', 'Confused', 'Paralyzed', 'Poison', 'Burn', 'Return to hand', 'Knock Out'])
    const noActive = reduce(board, { type: 'KNOCK_OUT', target: 'p1' })
    expect(labels(noActive, hand[1])[0]).toBe('Promote to Active')
  })

  it('reflects the markers already on a Pokémon', () => {
    const { state, hand } = game('Seedling')
    const board = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'ADD_DAMAGE', target: 'p1', amount: 20 }, { type: 'SET_CONDITION', target: 'p1', condition: 'asleep' }, { type: 'TOGGLE_POISON', target: 'p1' })
    expect(labels(board, hand[0])).toEqual(expect.arrayContaining(['−10', 'Clear Asleep', 'Clear Poison', 'Burn']))
  })

  it('every offered action changes the game', () => {
    const { state, hand } = game('Seedling', 'Pebble', 'Sprout', 'Grass Energy', 'Research')
    const board = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'PLAY_TO_BENCH', uid: hand[1] }, { type: 'ATTACH', uid: hand[3], target: 'p1' })
    const uids = [...hand, board.player.deck[0].uid, board.player.prizes[0].uid]
    for (const uid of uids) {
      for (const action of actionsFor(board, uid)) {
        if ('run' in action) expect(reduce(board, action.run), `${action.label} on ${uid}`).not.toBe(board)
      }
    }
  })
})
