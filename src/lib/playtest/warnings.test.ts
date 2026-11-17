// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { engineDeck, entry, pokemon, stage1 } from '../testUtils'
import { reduce } from './reducer'
import { createGame } from './setup'
import { handGame } from './testGame'
import type { Action, GameState, WarningCode } from './types'
import { computeWarnings } from './warnings'

// One deck for the whole file: engineDeck() mints new card ids on every call.
const DECK = engineDeck()
const game = (...names: string[]) => handGame(DECK, ...names)
const run = (state: GameState, ...actions: Action[]) => actions.reduce(reduce, state)
const codes = (state: GameState) => computeWarnings(state).map((w) => w.code)
const find = (state: GameState, code: WarningCode) => computeWarnings(state).find((w) => w.code === code)
const ENERGY = 'Grass Energy'

describe('computeWarnings', () => {
  it('is empty for a fresh game and for a legal turn', () => {
    const { state, hand } = game('Seedling', 'Pebble', ENERGY, 'Research', 'Arena')
    expect(codes(state)).toEqual([])
    const after = run(
      state,
      { type: 'MOVE', uid: hand[0], to: 'active' },
      { type: 'PLAY_TO_BENCH', uid: hand[1] },
      { type: 'ATTACH', uid: hand[2], target: hand[0] },
      { type: 'PLAY_TRAINER', uid: hand[3] },
      { type: 'PLAY_TRAINER', uid: hand[4] },
      { type: 'RETREAT', benchTarget: hand[1] },
    )
    expect(codes(after)).toEqual([])
  })

  it('never changes the state it reads', () => {
    const { state } = game('Seedling')
    const snapshot = JSON.stringify(state)
    computeWarnings(state)
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('bench-over-5', () => {
  const bench = (n: number) => {
    const { state, hand } = game('Seedling', 'Seedling', 'Seedling', 'Pebble', 'Pebble', 'Pebble')
    return { state: hand.slice(0, n).reduce((s, uid) => reduce(s, { type: 'PLAY_TO_BENCH', uid }), state), hand }
  }

  it('warns for a sixth Benched Pokémon and points at it', () => {
    const { state, hand } = bench(6)
    expect(find(state, 'bench-over-5')).toMatchObject({ relatedUids: [hand[5]] })
  })

  it('does not warn for five', () => {
    expect(codes(bench(5).state)).not.toContain('bench-over-5')
  })
})

describe('no-basic-in-setup-hand', () => {
  const noBasics = createGame([entry(stage1('Sprout', 'Seedling'), 10)], 1)

  it('warns during setup when the hand has no Basic Pokémon', () => {
    expect(codes(noBasics)).toContain('no-basic-in-setup-hand')
  })

  it('does not warn when the hand has a Basic, once a Pokémon is placed, or once playing', () => {
    expect(codes(createGame([entry(pokemon('Pikachu'), 10)], 1))).not.toContain('no-basic-in-setup-hand')
    const placed = reduce(noBasics, { type: 'PLACE_OPENING', active: noBasics.player.hand[0].uid, bench: [] })
    expect(codes(placed)).not.toContain('no-basic-in-setup-hand')
    expect(codes(reduce(noBasics, { type: 'START_GAME', goingFirst: true }))).not.toContain('no-basic-in-setup-hand')
  })
})

describe('multiple-supporters', () => {
  it('warns for a second Supporter in a turn, and clears next turn', () => {
    const { state, hand } = game('Research', 'Research')
    const one = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(codes(one)).not.toContain('multiple-supporters')
    const two = reduce(one, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(codes(two)).toContain('multiple-supporters')
    expect(codes(reduce(two, { type: 'END_TURN' }))).toEqual([])
  })
})

describe('supporter-first-turn', () => {
  const firstTurn = (goingFirst: boolean) => {
    const { state, hand } = game('Research')
    return reduce({ ...state, turn: 1, goingFirst }, { type: 'PLAY_TRAINER', uid: hand[0] })
  }

  it('warns for a Supporter on turn 1 when going first', () => {
    expect(codes(firstTurn(true))).toEqual(['supporter-first-turn'])
  })

  it('does not warn when going second, or on a later turn', () => {
    expect(codes(firstTurn(false))).toEqual([])
    const { state, hand } = game('Research')
    expect(codes(reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] }))).toEqual([])
  })
})

describe('multiple-energy-attachments', () => {
  it('warns for a second Energy attached from the hand', () => {
    const { state, hand } = game('Seedling', ENERGY, ENERGY)
    const one = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: hand[1], target: 'p1' })
    expect(codes(one)).toEqual([])
    expect(codes(reduce(one, { type: 'ATTACH', uid: hand[2], target: 'p1' }))).toEqual(['multiple-energy-attachments'])
  })

  it('does not warn for Energy attached from other zones or moved with MOVE', () => {
    const { state, hand } = game('Seedling', ENERGY)
    const fromDeck = state.player.deck.filter((c) => c.card.category === 'Energy').slice(0, 2)
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: hand[1], target: 'p1' }, { type: 'ATTACH', uid: fromDeck[0].uid, target: 'p1' }, { type: 'ATTACH', uid: fromDeck[1].uid, target: 'p1' })
    expect(after.player.bench[0].attached).toHaveLength(3)
    expect(codes(after)).toEqual([])
  })
})

describe('multiple-retreats', () => {
  it('warns for a second retreat in a turn but not the first', () => {
    const { state, hand } = game('Seedling', 'Pebble')
    const once = run(state, { type: 'MOVE', uid: hand[0], to: 'active' }, { type: 'PLAY_TO_BENCH', uid: hand[1] }, { type: 'RETREAT', benchTarget: hand[1] })
    expect(codes(once)).toEqual([])
    expect(codes(reduce(once, { type: 'RETREAT', benchTarget: hand[0] }))).toEqual(['multiple-retreats'])
  })
})

describe('multiple-stadiums and duplicate-stadium-name', () => {
  it('warns for a second Stadium in a turn, and for one with the same name as the Stadium in play', () => {
    const { state, hand } = game('Arena', 'Arena')
    const one = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    expect(codes(one)).toEqual([])
    const two = reduce(one, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(codes(two)).toEqual(['multiple-stadiums', 'duplicate-stadium-name'])
    expect(find(two, 'duplicate-stadium-name')?.relatedUids).toEqual([hand[1]])
  })

  it('warns only for the name when the same-name Stadium is played on a later turn', () => {
    const { state, hand } = game('Arena', 'Arena')
    const after = run(state, { type: 'PLAY_TRAINER', uid: hand[0] }, { type: 'END_TURN' }, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(codes(after)).toEqual(['duplicate-stadium-name'])
  })

  it('does not warn for a Stadium with a different name on a later turn', () => {
    const { state, hand } = game('Arena', 'Arena')
    const first = reduce(state, { type: 'PLAY_TRAINER', uid: hand[0] })
    const other = first.player.hand[0]
    const renamed: GameState = { ...first, player: { ...first.player, hand: [{ ...other, card: { ...other.card, name: 'Colosseum' } }] } }
    const after = run(renamed, { type: 'END_TURN' }, { type: 'PLAY_TRAINER', uid: hand[1] })
    expect(after.player.stadium?.card.name).toBe('Colosseum')
    expect(codes(after)).toEqual([])
  })
})

describe('evolve-mismatch', () => {
  const evolved = (lower: string, upper: string) => {
    const { state, hand } = game(lower, upper)
    return { state: run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'END_TURN' }, { type: 'EVOLVE', uid: hand[1], target: 'p1' }), hand }
  }

  it('warns when the card does not evolve from the one beneath it', () => {
    const { state, hand } = evolved('Pebble', 'Sprout')
    expect(codes(state)).toEqual(['evolve-mismatch'])
    expect(find(state, 'evolve-mismatch')).toMatchObject({ message: 'Sprout evolves from Seedling, not Pebble.', relatedUids: hand })
  })

  it('warns when a Stage 2 is put straight onto a Basic', () => {
    expect(codes(evolved('Seedling', 'Bloom').state)).toEqual(['evolve-mismatch'])
  })

  it('does not warn for the right evolution, ignoring case and accents', () => {
    expect(codes(evolved('Seedling', 'Sprout').state)).toEqual([])
    const { state } = evolved('Seedling', 'Sprout')
    const slot = state.player.bench[0]
    const accented: GameState = { ...state, player: { ...state.player, bench: [{ ...slot, stack: [{ ...slot.stack[0], card: { ...slot.stack[0].card, name: 'Séedling' } }, { ...slot.stack[1], card: { ...slot.stack[1].card, evolveFrom: 'SEEDLING' } }] }] } }
    expect(codes(accented)).toEqual([])
  })

  it('is skipped when evolveFrom is unknown', () => {
    const { state } = evolved('Pebble', 'Sprout')
    const slot = state.player.bench[0]
    const unknown: GameState = { ...state, player: { ...state.player, bench: [{ ...slot, stack: [slot.stack[0], { ...slot.stack[1], card: { ...slot.stack[1].card, evolveFrom: undefined } }] }] } }
    expect(codes(unknown)).toEqual([])
  })
})

describe('evolve-same-turn', () => {
  it('warns when a Pokémon evolves the turn it came into play', () => {
    const { state, hand } = game('Seedling', 'Sprout')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'EVOLVE', uid: hand[1], target: 'p1' })
    expect(find(after, 'evolve-same-turn')).toMatchObject({ message: 'Sprout was evolved too early: it came into play this turn.', relatedUids: hand })
  })

  it('warns when a Pokémon evolves twice in one turn', () => {
    const { state, hand } = game('Seedling', 'Sprout', 'Bloom')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'END_TURN' }, { type: 'EVOLVE', uid: hand[1], target: 'p1' }, { type: 'EVOLVE', uid: hand[2], target: 'p1' })
    expect(find(after, 'evolve-same-turn')?.message).toBe('Bloom was evolved too early: it evolved 2 times this turn.')
  })

  it('warns for any evolution on turn 1', () => {
    const { state, hand } = game('Seedling', 'Sprout')
    const benched = reduce({ ...state, turn: 0 }, { type: 'PLAY_TO_BENCH', uid: hand[0] })
    const after = reduce({ ...benched, turn: 1 }, { type: 'EVOLVE', uid: hand[1], target: 'p1' })
    expect(find(after, 'evolve-same-turn')?.message).toBe("Sprout was evolved too early: Pokémon can't evolve on the first turn.")
  })

  it('does not warn for one evolution per turn on a Pokémon that was already in play, and clears next turn', () => {
    const { state, hand } = game('Seedling', 'Sprout', 'Bloom')
    const stage1Turn = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'END_TURN' }, { type: 'EVOLVE', uid: hand[1], target: 'p1' })
    expect(codes(stage1Turn)).toEqual([])
    const stage2Turn = run(stage1Turn, { type: 'END_TURN' }, { type: 'EVOLVE', uid: hand[2], target: 'p1' })
    expect(codes(stage2Turn)).toEqual([])
    const early = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'EVOLVE', uid: hand[1], target: 'p1' }, { type: 'END_TURN' })
    expect(codes(early)).toEqual([])
  })
})

describe('prize-count', () => {
  it('does not warn while Prize cards are taken normally', () => {
    const { state } = game()
    const after = run(state, { type: 'TAKE_PRIZE', uid: state.player.prizes[0].uid }, { type: 'TAKE_PRIZE', uid: state.player.prizes[1].uid })
    expect(after.player.prizes).toHaveLength(4)
    expect(codes(after)).toEqual([])
  })

  it('warns for more than 6 Prize cards', () => {
    const { state } = game()
    const after = reduce(state, { type: 'MOVE', uid: state.player.deck[0].uid, to: 'prizes' })
    expect(find(after, 'prize-count')?.message).toBe('7 Prize cards. There should never be more than 6.')
  })

  it('warns when fewer Prize cards are left than expected', () => {
    const { state } = game()
    const prize = state.player.prizes[0]
    const lost: GameState = { ...state, player: { ...state.player, prizes: state.player.prizes.slice(1), discard: [prize] } }
    expect(find(lost, 'prize-count')?.message).toBe('5 Prize cards left, but 6 expected after taking 0.')
  })

  it('does not warn during setup, before Prize cards are set', () => {
    expect(codes(createGame(DECK, 3))).not.toContain('prize-count')
  })
})

describe('non-pokemon-in-play', () => {
  it('warns when a Trainer or Energy is put in play as a Pokémon', () => {
    const { state, hand } = game('Ball', 'Seedling')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'PLAY_TO_BENCH', uid: hand[1] })
    expect(find(after, 'non-pokemon-in-play')).toMatchObject({ relatedUids: [hand[0]] })
  })

  it('does not warn for attached Energy and Tools', () => {
    const { state, hand } = game('Seedling', ENERGY, 'Cape')
    const after = run(state, { type: 'PLAY_TO_BENCH', uid: hand[0] }, { type: 'ATTACH', uid: hand[1], target: 'p1' }, { type: 'ATTACH', uid: hand[2], target: 'p1' })
    expect(codes(after)).toEqual([])
  })
})
