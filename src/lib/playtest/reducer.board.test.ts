// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { engineDeck } from '../testUtils'
import { assertConservation } from './invariants'
import { reduce } from './reducer'
import { handGame } from './testGame'
import { findInPlay, locate, topCard } from './selectors'
import type { Action, GameState } from './types'

// One deck for the whole file: engineDeck() mints new card ids on every call.
const DECK = engineDeck()
const run = (state: GameState, ...actions: Action[]) => actions.reduce(reduce, state)
const uids = (cards: { uid: string }[]) => cards.map((c) => c.uid)
const lastLog = (state: GameState) => state.log[state.log.length - 1].text

const game = (...names: string[]) => handGame(DECK, ...names)

const ENERGY = 'Grass Energy'

describe('PLAY_TO_BENCH', () => {
  it('moves a card from the hand into a new Bench slot', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    expect(after.player.bench.map((s) => topCard(s).uid)).toEqual(hand)
    expect(after.player.bench[0]).toMatchObject({ id: 'p1', damage: 0, enteredPlayOnTurn: 2, evolvedOnTurn: null })
    expect(after.player.hand).toEqual([])
    expect(lastLog(after)).toBe('Played Pebble to the Bench.')
    assertConservation(after)
  })

  it('is a no-op (same reference) for a card that is not in the hand', () => {
    const { state } = game('Seedling')
    expect(reduce(state, { type: 'PLAY_TO_BENCH', uid: state.player.deck[0].uid })).toBe(state)
    expect(reduce(state, { type: 'PLAY_TO_BENCH', uid: 'nope#1' })).toBe(state)
  })
})

describe('EVOLVE', () => {
  it('keeps attachments and damage, clears conditions and records the turn', () => {
    const { state, hand } = game('Seedling', ENERGY, 'Cape', 'Sprout')
    const [basic, energy, tool, stage1] = hand
    const before = run(
      state,
      { type: 'MOVE', uid: basic, to: 'active' },
      { type: 'ATTACH', uid: energy, target: basic },
      { type: 'ATTACH', uid: tool, target: basic },
      { type: 'ADD_DAMAGE', target: basic, amount: 30 },
      { type: 'SET_CONDITION', target: basic, condition: 'asleep' },
      { type: 'TOGGLE_POISON', target: basic },
      { type: 'TOGGLE_BURN', target: basic },
      { type: 'END_TURN' },
    )
    const after = reduce(before, { type: 'EVOLVE', uid: stage1, target: basic })
    const active = after.player.active!
    expect(uids(active.stack)).toEqual([basic, stage1])
    expect(uids(active.attached)).toEqual([energy, tool])
    expect(active).toMatchObject({ id: 'p1', damage: 30, condition: null, poisoned: false, burned: false, enteredPlayOnTurn: 2, evolvedOnTurn: 3, evolutionsOnTurn: 1 })
    expect(lastLog(after)).toBe('Evolved Seedling into Sprout.')
    assertConservation(after)
  })

  it('does not check evolveFrom (a mismatch is only a warning)', () => {
    const { state, hand } = game('Pebble', 'Bloom')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'EVOLVE', uid: hand[1], target: hand[0] })
    expect(uids(after.player.bench[0].stack)).toEqual(hand)
  })

  it('accepts a card from any zone', () => {
    const { state, hand } = game('Seedling')
    const stage1 = state.player.deck.find((c) => c.card.name === 'Sprout')!.uid
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'EVOLVE', uid: stage1, target: 'p1' })
    expect(topCard(after.player.bench[0]).uid).toBe(stage1)
    expect(after.player.deck).toHaveLength(state.player.deck.length - 1)
  })

  it('is a no-op (same reference) for an unknown card or target, or a card already in that Pokémon', () => {
    const { state, hand } = game('Seedling', 'Sprout')
    const benched = reduce(state, { type: 'PLAY_TO_BENCH', uid: hand[0] })
    expect(reduce(benched, { type: 'EVOLVE', uid: 'nope#1', target: 'p1' })).toBe(benched)
    expect(reduce(benched, { type: 'EVOLVE', uid: hand[1], target: 'p9' })).toBe(benched)
    expect(reduce(benched, { type: 'EVOLVE', uid: hand[0], target: 'p1' })).toBe(benched)
  })
})

describe('ATTACH', () => {
  it('counts an Energy attached from the hand', () => {
    const { state, hand } = game('Seedling', ENERGY, ENERGY)
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: hand[1], target: 'p1' }, { type: 'ATTACH', uid: hand[2], target: 'p1' })
    expect(uids(after.player.bench[0].attached)).toEqual([hand[1], hand[2]])
    expect(after.turnCounts.energyAttached).toBe(2)
    expect(lastLog(after)).toBe('Attached Grass Energy to Seedling.')
  })

  it('does not count an Energy attached from another zone, or a Tool', () => {
    const { state, hand } = game('Seedling', 'Cape')
    const energy = state.player.deck.find((c) => c.card.category === 'Energy')!.uid
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: energy, target: 'p1' }, { type: 'ATTACH', uid: hand[1], target: 'p1' })
    expect(uids(after.player.bench[0].attached)).toEqual([energy, hand[1]])
    expect(after.turnCounts.energyAttached).toBe(0)
    assertConservation(after)
  })

  it('moves an attachment from one Pokémon to another without counting it', () => {
    const { state, hand } = game('Seedling', 'Pebble', ENERGY)
    const [a, b, energy] = hand
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: a }, { type: 'PLAY_TO_BENCH', uid: b }, { type: 'ATTACH', uid: energy, target: a })
    const after = reduce(before, { type: 'ATTACH', uid: energy, target: b })
    expect(after.player.bench[0].attached).toEqual([])
    expect(uids(after.player.bench[1].attached)).toEqual([energy])
    expect(after.turnCounts.energyAttached).toBe(1)
  })

  it('is a no-op (same reference) for an unknown card or target, or a card already on that Pokémon', () => {
    const { state, hand } = game('Seedling', ENERGY)
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: hand[1], target: 'p1' })
    expect(reduce(before, { type: 'ATTACH', uid: hand[1], target: 'p1' })).toBe(before)
    expect(reduce(before, { type: 'ATTACH', uid: hand[0], target: 'p1' })).toBe(before)
    expect(reduce(before, { type: 'ATTACH', uid: 'nope#1', target: 'p1' })).toBe(before)
    expect(reduce(before, { type: 'ATTACH', uid: before.player.deck[0].uid, target: 'p9' })).toBe(before)
  })
})

describe('PLAY_TRAINER', () => {
  it('discards a Supporter and counts it', () => {
    const { state, hand } = game('Research', 'Research')
    const after = run(state, { type: 'PLAY_TRAINER', uid: hand[0] }, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(uids(after.player.discard)).toEqual(hand)
    expect(after.turnCounts).toMatchObject({ supportersPlayed: 2, stadiumsPlayed: 0 })
    expect(lastLog(after)).toBe('Played the Supporter Research.')
  })

  it('discards an Item without counting anything', () => {
    const { state, hand } = game('Ball')
    const after = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(uids(after.player.discard)).toEqual(hand)
    expect(after.turnCounts).toEqual(state.turnCounts)
  })

  it('puts a Stadium in the Stadium spot, and a second Stadium discards the first', () => {
    const { state, hand } = game('Arena', 'Arena')
    const first = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(first.player.stadium?.uid).toBe(hand[0])
    expect(first.player.discard).toEqual([])
    const second = reduce(first, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(second.player.stadium?.uid).toBe(hand[1])
    expect(uids(second.player.discard)).toEqual([hand[0]])
    expect(second.turnCounts).toMatchObject({ stadiumsPlayed: 2, sameNameStadiums: 1 })
    expect(lastLog(second)).toBe('Played the Stadium Arena (Arena was discarded).')
    assertConservation(second)
  })

  it('leaves a Tool in the hand and only logs', () => {
    const { state, hand } = game('Cape')
    const after = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(after.player).toBe(state.player)
    expect(after.turnCounts).toBe(state.turnCounts)
    expect(lastLog(after)).toBe('Cape is a Pokémon Tool: attach it to a Pokémon instead.')
  })

  it('discards a Trainer with an unknown type without counting anything', () => {
    const { state, hand } = game('Ball')
    const card = state.player.hand[0]
    const odd: GameState = { ...state, player: { ...state.player, hand: [{ ...card, card: { ...card.card, trainerType: undefined } }] } }
    const after = reduce(odd, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(uids(after.player.discard)).toEqual(hand)
    expect(after.turnCounts).toEqual(state.turnCounts)
  })

  it('is a no-op (same reference) for a non-Trainer or a card that is not in the hand', () => {
    const { state, hand } = game('Seedling')
    const trainerInDeck = state.player.deck.find((c) => c.card.category === 'Trainer')!.uid
    expect(reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })).toBe(state)
    expect(reduce(state, { type: 'PLAY_TRAINER', uid: trainerInDeck })).toBe(state)
    expect(reduce(state, { type: 'PLAY_TRAINER', uid: 'nope#1' })).toBe(state)
  })
})

describe('RETREAT', () => {
  const board = () => {
    const { state, hand } = game('Seedling', 'Pebble', 'Seedling', ENERGY)
    const [active, benchA, benchB, energy] = hand
    const ready = run(
      state,
      { type: 'MOVE', uid: active, to: 'active' },
      { type: 'PLAY_TO_BENCH', uid: benchA },
      { type: 'PLAY_TO_BENCH', uid: benchB },
      { type: 'ATTACH', uid: energy, target: active },
      { type: 'ADD_DAMAGE', target: active, amount: 20 },
      { type: 'SET_CONDITION', target: active, condition: 'confused' },
      { type: 'TOGGLE_POISON', target: active },
    )
    return { ready, active, benchA, benchB, energy }
  }

  it('swaps the Active Pokémon with the chosen Benched one, in the same Bench position', () => {
    const { ready, active, benchA, benchB, energy } = board()
    const after = reduce(ready, { type: 'RETREAT', benchTarget: benchA })
    expect(after.player.active).toMatchObject({ id: 'p2' })
    expect(topCard(after.player.active!).uid).toBe(benchA)
    expect(after.player.bench.map((s) => topCard(s).uid)).toEqual([active, benchB])
    expect(after.player.bench[0]).toMatchObject({ id: 'p1', damage: 20, condition: null, poisoned: false, burned: false })
    expect(uids(after.player.bench[0].attached)).toEqual([energy])
    expect(after.turnCounts.retreats).toBe(1)
    expect(lastLog(after)).toBe('Retreated Seedling and sent out Pebble.')
    assertConservation(after)
  })

  it('counts every retreat in a turn', () => {
    const { ready, active, benchA } = board()
    const after = run(ready, { type: 'RETREAT', benchTarget: benchA }, { type: 'RETREAT', benchTarget: active })
    expect(topCard(after.player.active!).uid).toBe(active)
    expect(after.turnCounts.retreats).toBe(2)
  })

  it('is a no-op (same reference) without an Active Pokémon, for an unknown target, or for the Active itself', () => {
    const { ready, active, benchA } = board()
    expect(reduce(ready, { type: 'RETREAT', benchTarget: 'p9' })).toBe(ready)
    expect(reduce(ready, { type: 'RETREAT', benchTarget: active })).toBe(ready)
    const noActive = reduce(ready, { type: 'KNOCK_OUT', target: active })
    expect(reduce(noActive, { type: 'RETREAT', benchTarget: benchA })).toBe(noActive)
  })
})

describe('PROMOTE', () => {
  it('moves a Benched Pokémon into an empty Active Spot with everything on it', () => {
    const { state, hand } = game('Seedling', 'Pebble', ENERGY)
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'PLAY_TO_BENCH', uid: hand[1] }, { type: 'ATTACH', uid: hand[2], target: hand[1] }, { type: 'ADD_DAMAGE', target: hand[1], amount: 10 })
    const after = reduce(before, { type: 'PROMOTE', benchTarget: hand[1] })
    expect(after.player.active).toBe(before.player.bench[1])
    expect(after.player.bench.map((s) => s.id)).toEqual(['p1'])
    expect(after.turnCounts.retreats).toBe(0)
    expect(lastLog(after)).toBe('Promoted Pebble to the Active Spot.')
  })

  it('is a no-op (same reference) when the Active Spot is occupied or the target is unknown', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const before = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    expect(reduce(before, { type: 'PROMOTE', benchTarget: hand[1] })).toBe(before)
    const empty = reduce(before, { type: 'KNOCK_OUT', target: hand[0] })
    expect(reduce(empty, { type: 'PROMOTE', benchTarget: 'p9' })).toBe(empty)
  })
})

describe('KNOCK_OUT', () => {
  it('sends a 2-card stack with a Tool and 3 Energy (6 cards) to the discard pile', () => {
    const { state, hand } = game('Seedling', 'Sprout', 'Cape', ENERGY, ENERGY, ENERGY)
    const [basic, stage1, tool, e1, e2, e3] = hand
    const before = run(
      state,
      { type: 'MOVE', uid: basic, to: 'active' },
      { type: 'EVOLVE', uid: stage1, target: basic },
      { type: 'ATTACH', uid: tool, target: basic },
      { type: 'ATTACH', uid: e1, target: basic },
      { type: 'ATTACH', uid: e2, target: basic },
      { type: 'ATTACH', uid: e3, target: basic },
    )
    const after = reduce(before, { type: 'KNOCK_OUT', target: stage1 })
    expect(after.player.active).toBeNull()
    expect(uids(after.player.discard)).toEqual([basic, stage1, tool, e1, e2, e3])
    expect(lastLog(after)).toBe('Sprout was Knocked Out (6 cards discarded).')
    assertConservation(after)
  })

  it('does not promote or take Prize cards', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const before = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    const after = reduce(before, { type: 'KNOCK_OUT', target: 'p1' })
    expect(after.player.active).toBeNull()
    expect(after.player.bench).toBe(before.player.bench)
    expect(after.player.prizes).toBe(before.player.prizes)
    expect(after.prizesTaken).toBe(0)
  })

  it('removes a Benched Pokémon and keeps the others', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    const after = reduce(before, { type: 'KNOCK_OUT', target: hand[0] })
    expect(after.player.bench.map((s) => s.id)).toEqual(['p2'])
    expect(reduce(before, { type: 'KNOCK_OUT', target: 'nope#1' })).toBe(before)
  })
})

describe('targets', () => {
  it('resolve from a slot id, a stack card uid, or an attached card uid', () => {
    const { state, hand } = game('Seedling', 'Sprout', ENERGY)
    const [basic, stage1, energy] = hand
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: basic }, { type: 'EVOLVE', uid: stage1, target: 'p1' }, { type: 'ATTACH', uid: energy, target: stage1 })
    for (const ref of ['p1', basic, stage1, energy]) {
      expect(findInPlay(before, ref)?.id).toBe('p1')
      expect(reduce(before, { type: 'ADD_DAMAGE', target: ref, amount: 10 }).player.bench[0].damage).toBe(10)
    }
  })
})

describe('MOVE on a Pokémon in play', () => {
  it('taking the bottom Basic out of a 2-card stack leaves a 1-card stack with the same slot id', () => {
    const { state, hand } = game('Seedling', 'Sprout', ENERGY)
    const [basic, stage1, energy] = hand
    const before = run(state, { type: 'PLAY_TO_BENCH', uid: basic }, { type: 'EVOLVE', uid: stage1, target: basic }, { type: 'ATTACH', uid: energy, target: basic }, { type: 'ADD_DAMAGE', target: basic, amount: 40 })
    const after = reduce(before, { type: 'MOVE', uid: basic, to: 'hand' })
    expect(after.player.bench).toHaveLength(1)
    expect(after.player.bench[0]).toMatchObject({ id: 'p1', damage: 40 })
    expect(uids(after.player.bench[0].stack)).toEqual([stage1])
    expect(uids(after.player.bench[0].attached)).toEqual([energy])
    expect(locate(after, basic)?.zone).toBe('hand')
    assertConservation(after)
  })

  it('devolving by moving the top card away keeps the slot', () => {
    const { state, hand } = game('Seedling', 'Sprout')
    const before = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'EVOLVE', uid: hand[1], target: 'p1' })
    const after = reduce(before, { type: 'MOVE', uid: hand[1], to: 'hand' })
    expect(after.player.active?.id).toBe('p1')
    expect(topCard(after.player.active!).uid).toBe(hand[0])
  })

  it('moving an attached card to the discard pile pays a cost without touching the Pokémon', () => {
    const { state, hand } = game('Seedling', ENERGY)
    const before = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'ATTACH', uid: hand[1], target: 'p1' })
    const after = reduce(before, { type: 'MOVE', uid: hand[1], to: 'discard' })
    expect(after.player.active?.attached).toEqual([])
    expect(uids(after.player.active!.stack)).toEqual([hand[0]])
    expect(uids(after.player.discard)).toEqual([hand[1]])
  })
})

describe('ADD_DAMAGE', () => {
  const board = () => {
    const { state, hand } = game('Seedling')
    return reduce(state, { type: 'MOVE', uid: hand[0], to: 'active' })
  }

  it('adds and heals in multiples of 10', () => {
    const after = run(board(), { type: 'ADD_DAMAGE', target: 'p1', amount: 50 }, { type: 'ADD_DAMAGE', target: 'p1', amount: -20 })
    expect(after.player.active?.damage).toBe(30)
    expect(lastLog(after)).toBe('Healed 20 damage from Seedling (30 left).')
  })

  it('clamps at 0', () => {
    const after = run(board(), { type: 'ADD_DAMAGE', target: 'p1', amount: 20 }, { type: 'ADD_DAMAGE', target: 'p1', amount: -50 })
    expect(after.player.active?.damage).toBe(0)
    expect(lastLog(after)).toBe('Healed 20 damage from Seedling (0 left).')
  })

  it('is a no-op (same reference) for an amount that is not a multiple of 10, zero, healing at 0, or an unknown target', () => {
    const state = board()
    for (const amount of [5, 15, 0, 10.5, -10, Number.NaN]) expect(reduce(state, { type: 'ADD_DAMAGE', target: 'p1', amount })).toBe(state)
    expect(reduce(state, { type: 'ADD_DAMAGE', target: 'p9', amount: 10 })).toBe(state)
  })
})

describe('conditions', () => {
  const board = () => {
    const { state, hand } = game('Seedling')
    return reduce(state, { type: 'MOVE', uid: hand[0], to: 'active' })
  }

  it('SET_CONDITION replaces the previous condition and can clear it', () => {
    const asleep = reduce(board(), { type: 'SET_CONDITION', target: 'p1', condition: 'asleep' })
    expect(asleep.player.active?.condition).toBe('asleep')
    expect(lastLog(asleep)).toBe('Seedling is now Asleep.')
    const paralyzed = reduce(asleep, { type: 'SET_CONDITION', target: 'p1', condition: 'paralyzed' })
    expect(paralyzed.player.active?.condition).toBe('paralyzed')
    const cleared = reduce(paralyzed, { type: 'SET_CONDITION', target: 'p1', condition: null })
    expect(cleared.player.active?.condition).toBeNull()
    expect(lastLog(cleared)).toBe('Seedling is no longer Paralyzed.')
  })

  it('SET_CONDITION is a no-op (same reference) when nothing changes or the target is unknown', () => {
    const state = board()
    expect(reduce(state, { type: 'SET_CONDITION', target: 'p1', condition: null })).toBe(state)
    expect(reduce(state, { type: 'SET_CONDITION', target: 'p9', condition: 'asleep' })).toBe(state)
    const asleep = reduce(state, { type: 'SET_CONDITION', target: 'p1', condition: 'asleep' })
    expect(reduce(asleep, { type: 'SET_CONDITION', target: 'p1', condition: 'asleep' })).toBe(asleep)
  })

  it('poison and burn toggle independently of the condition', () => {
    const state = run(board(), { type: 'SET_CONDITION', target: 'p1', condition: 'confused' }, { type: 'TOGGLE_POISON', target: 'p1' }, { type: 'TOGGLE_BURN', target: 'p1' })
    expect(state.player.active).toMatchObject({ condition: 'confused', poisoned: true, burned: true })
    expect(lastLog(state)).toBe('Seedling is now Burned.')
    const after = reduce(state, { type: 'TOGGLE_POISON', target: 'p1' })
    expect(after.player.active).toMatchObject({ condition: 'confused', poisoned: false, burned: true })
    expect(lastLog(after)).toBe('Seedling is no longer Poisoned.')
    expect(reduce(state, { type: 'TOGGLE_BURN', target: 'p9' })).toBe(state)
  })
})

describe('a short game', () => {
  it('conserves every card and is reproducible', () => {
    const play = () => {
      const { state, hand } = game('Seedling', 'Pebble', 'Sprout', ENERGY, 'Research', 'Arena', 'Cape')
      const [seedling, pebble, sprout, energy, research, arena, cape] = hand
      const actions: Action[] = [
        { type: 'MOVE', uid: seedling, to: 'active' },
        { type: 'PLAY_TO_BENCH', uid: pebble },
        { type: 'ATTACH', uid: energy, target: seedling },
        { type: 'PLAY_TRAINER', uid: research },
        { type: 'DRAW', count: 3 },
        { type: 'PLAY_TRAINER', uid: arena },
        { type: 'ATTACH', uid: cape, target: pebble },
        { type: 'END_TURN' },
        { type: 'EVOLVE', uid: sprout, target: seedling },
        { type: 'ADD_DAMAGE', target: seedling, amount: 100 },
        { type: 'KNOCK_OUT', target: seedling },
        { type: 'PROMOTE', benchTarget: pebble },
        { type: 'FLIP_COIN' },
      ]
      let s = state
      for (const action of actions) {
        s = reduce(s, action)
        assertConservation(s)
      }
      return s
    }
    const a = play()
    expect(a).toEqual(play())
    expect(topCard(a.player.active!).card.name).toBe('Pebble')
    expect(a.player.discard).toHaveLength(4)
  })
})
