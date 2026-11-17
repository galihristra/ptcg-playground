// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { basicEnergy, engineDeck, entry, pokemon } from '../testUtils'
import { assertConservation, collectUids } from './invariants'
import { reduce } from './reducer'
import { ZONES, allPokemonInPlay, findInPlay, hasBasicInHand, locate, topCard, zoneCounts } from './selectors'
import { createGame } from './setup'
import type { Action, GameState, Zone } from './types'

const run = (state: GameState, ...actions: Action[]) => actions.reduce(reduce, state)
const uids = (cards: { uid: string }[]) => cards.map((c) => c.uid)
const lastLog = (state: GameState) => state.log[state.log.length - 1].text

// One deck for the whole file: engineDeck() mints new card ids on every call.
const DECK = engineDeck()
const setup = (seed = 1) => createGame(DECK, seed)
const playing = (seed = 1) => reduce(setup(seed), { type: 'START_GAME', goingFirst: true })

/** A playing game with one card sitting in `zone`, and that card's uid. */
function withCardIn(zone: Zone): { state: GameState; uid: string } {
  const base = playing()
  const p = base.player
  if (zone === 'deck') return { state: base, uid: p.deck[3].uid }
  if (zone === 'hand') return { state: base, uid: p.hand[0].uid }
  if (zone === 'prizes') return { state: base, uid: p.prizes[0].uid }
  const uid = p.hand[0].uid
  return { state: reduce(base, { type: 'MOVE', uid, to: zone }), uid }
}

describe('createGame with no actions', () => {
  it('has 7 in hand and 53 in the deck', () => {
    expect(zoneCounts(setup())).toEqual({ deck: 53, hand: 7, prizes: 0, discard: 0, lostZone: 0, stadium: 0, active: 0, bench: 0 })
  })
})

describe('invalid actions', () => {
  it('return the same state reference for an unknown uid, with no log', () => {
    const state = playing()
    expect(reduce(state, { type: 'MOVE', uid: 'nope#1', to: 'discard' })).toBe(state)
    expect(reduce(state, { type: 'TAKE_PRIZE', uid: 'nope#1' })).toBe(state)
    expect(reduce(state, { type: 'PUT_ON_BOTTOM', uids: ['nope#1'] })).toBe(state)
    expect(reduce(state, { type: 'PUT_ON_BOTTOM', uids: [] })).toBe(state)
  })

  it('never mutate the previous state', () => {
    const state = playing()
    const snapshot = JSON.stringify(state)
    run(
      state,
      { type: 'DRAW', count: 3 },
      { type: 'MOVE', uid: state.player.hand[0].uid, to: 'bench' },
      { type: 'SHUFFLE_DECK' },
      { type: 'TAKE_PRIZE', uid: state.player.prizes[0].uid },
      { type: 'END_TURN' },
    )
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('MULLIGAN', () => {
  it('returns the hand, reshuffles, redraws 7 and counts the mulligan', () => {
    const before = setup()
    const after = reduce(before, { type: 'MULLIGAN' })
    expect(after.player.hand).toHaveLength(7)
    expect(after.player.deck).toHaveLength(53)
    expect(after.mulligans).toBe(1)
    expect(after.rng).not.toBe(before.rng)
    expect(uids([...after.player.hand, ...after.player.deck])).not.toEqual(uids([...before.player.hand, ...before.player.deck]))
    expect(lastLog(after)).toBe('Mulligan 1: shuffled the hand into the deck and drew 7.')
    assertConservation(after)
    expect(run(after, { type: 'MULLIGAN' }).mulligans).toBe(2)
  })

  it('is deterministic for the same seed', () => {
    expect(reduce(setup(5), { type: 'MULLIGAN' })).toEqual(reduce(setup(5), { type: 'MULLIGAN' }))
  })

  it('is a no-op (same reference) once playing', () => {
    const state = playing()
    expect(reduce(state, { type: 'MULLIGAN' })).toBe(state)
  })
})

describe('PLACE_OPENING', () => {
  it('moves the chosen cards from hand to the Active Spot and Bench with fresh slot ids', () => {
    const before = setup()
    const [a, b, c] = uids(before.player.hand)
    const after = reduce(before, { type: 'PLACE_OPENING', active: a, bench: [b, c] })
    expect(after.player.hand).toHaveLength(4)
    expect(after.player.active).toMatchObject({ id: 'p1', damage: 0, condition: null, enteredPlayOnTurn: 0, evolvedOnTurn: null, attached: [] })
    expect(uids(after.player.active!.stack)).toEqual([a])
    expect(after.player.bench.map((s) => s.id)).toEqual(['p2', 'p3'])
    expect(after.player.bench.map((s) => topCard(s).uid)).toEqual([b, c])
    expect(after.nextSlot).toBe(4)
    assertConservation(after)
  })

  it('works with an empty bench', () => {
    const before = setup()
    const after = reduce(before, { type: 'PLACE_OPENING', active: before.player.hand[0].uid, bench: [] })
    expect(zoneCounts(after)).toMatchObject({ hand: 6, active: 1, bench: 0 })
  })

  it('is a no-op (same reference) for cards not in hand or listed twice', () => {
    const state = setup()
    const [a] = uids(state.player.hand)
    expect(reduce(state, { type: 'PLACE_OPENING', active: state.player.deck[0].uid, bench: [] })).toBe(state)
    expect(reduce(state, { type: 'PLACE_OPENING', active: a, bench: [a] })).toBe(state)
    expect(reduce(state, { type: 'PLACE_OPENING', active: a, bench: ['nope#1'] })).toBe(state)
  })

  it('only logs when the Active Spot is already occupied', () => {
    const [a, b] = uids(setup().player.hand)
    const placed = reduce(setup(), { type: 'PLACE_OPENING', active: a, bench: [] })
    const again = reduce(placed, { type: 'PLACE_OPENING', active: b, bench: [] })
    expect(again).not.toBe(placed)
    expect({ ...again, log: placed.log }).toEqual(placed)
  })

  it('is a no-op (same reference) once playing', () => {
    const state = playing()
    expect(reduce(state, { type: 'PLACE_OPENING', active: state.player.hand[0].uid, bench: [] })).toBe(state)
  })
})

describe('START_GAME', () => {
  it('sets 6 prizes from the top of the deck and starts turn 1', () => {
    const before = setup()
    const after = reduce(before, { type: 'START_GAME', goingFirst: false })
    expect(uids(after.player.prizes)).toEqual(uids(before.player.deck.slice(0, 6)))
    expect(uids(after.player.deck)).toEqual(uids(before.player.deck.slice(6)))
    expect(after).toMatchObject({ phase: 'playing', turn: 1, goingFirst: false, prizesTaken: 0 })
    expect(after.player.hand).toBe(before.player.hand)
    expect(lastLog(after)).toBe('Game started, going second. Set 6 Prize cards. Turn 1.')
  })

  it('sets as many prizes as it can from a short deck and logs it', () => {
    const small = createGame([entry(pokemon('Pikachu'), 4), entry(basicEnergy(), 6)], 3)
    const after = reduce(small, { type: 'START_GAME', goingFirst: true })
    expect(zoneCounts(after)).toMatchObject({ hand: 7, prizes: 3, deck: 0 })
    expect(lastLog(after)).toBe('Game started, going first. Only 3 cards left in the deck, so set 3 Prize cards. Turn 1.')
  })

  it('is a no-op (same reference) once playing', () => {
    const state = playing()
    expect(reduce(state, { type: 'START_GAME', goingFirst: false })).toBe(state)
  })
})

describe('DRAW', () => {
  it('moves cards from the top of the deck to the hand in order', () => {
    const before = playing()
    const after = reduce(before, { type: 'DRAW', count: 2 })
    expect(uids(after.player.hand)).toEqual([...uids(before.player.hand), ...uids(before.player.deck.slice(0, 2))])
    expect(after.player.deck).toHaveLength(45)
    expect(lastLog(after)).toBe('Drew 2 cards.')
  })

  it('draws what is left past the end of the deck and logs it', () => {
    const before = playing()
    const after = reduce(before, { type: 'DRAW', count: 100 })
    expect(zoneCounts(after)).toMatchObject({ deck: 0, hand: 54 })
    expect(lastLog(after)).toBe('Drew 47 of 100: the deck is now empty.')
    assertConservation(after)
  })

  it('only adds a log line when the deck is empty', () => {
    const empty = reduce(playing(), { type: 'DRAW', count: 47 })
    const after = reduce(empty, { type: 'DRAW', count: 1 })
    expect(after.player).toBe(empty.player)
    expect(lastLog(after)).toBe("Can't draw: the deck is empty.")
  })

  it('is a no-op (same reference) for a count below 1 or a fraction', () => {
    const state = playing()
    expect(reduce(state, { type: 'DRAW', count: 0 })).toBe(state)
    expect(reduce(state, { type: 'DRAW', count: -2 })).toBe(state)
    expect(reduce(state, { type: 'DRAW', count: 1.5 })).toBe(state)
  })
})

describe('MOVE', () => {
  describe.each(ZONES)('from %s', (from) => {
    it.each(ZONES)('to %s', (to) => {
      const { state, uid } = withCardIn(from)
      expect(locate(state, uid)?.zone).toBe(from)
      const after = reduce(state, { type: 'MOVE', uid, to })
      if (from === to && to !== 'deck') {
        expect(after).toBe(state)
      } else {
        expect(locate(after, uid)?.zone).toBe(to)
        expect(after.log).toHaveLength(state.log.length + 1)
        if (from !== to) expect(zoneCounts(after)[from]).toBe(zoneCounts(state)[from] - 1)
      }
      assertConservation(after)
      expect(after.prizesTaken).toBe(from === 'prizes' && to !== 'prizes' ? 1 : 0)
    })
  })

  it('puts a card on top of the deck by default and on the bottom when asked', () => {
    const state = playing()
    const [a, b] = uids(state.player.hand)
    const after = run(state, { type: 'MOVE', uid: a, to: 'deck' }, { type: 'MOVE', uid: b, to: 'deck', position: 'bottom' })
    expect(after.player.deck[0].uid).toBe(a)
    expect(after.player.deck[after.player.deck.length - 1].uid).toBe(b)
    expect(after.rng).toBe(state.rng)
    expect(lastLog(after)).toMatch(/to the bottom of the deck\.$/)
  })

  it('re-positions a card that is already in the deck', () => {
    const state = playing()
    const uid = state.player.deck[10].uid
    const after = reduce(state, { type: 'MOVE', uid, to: 'deck' })
    expect(after.player.deck[0].uid).toBe(uid)
    expect(after.player.deck).toHaveLength(state.player.deck.length)
  })

  it('creates a Pokémon in play with a new slot id and the current turn', () => {
    const state = run(playing(), { type: 'END_TURN' }, { type: 'END_TURN' })
    const [a, b] = uids(state.player.hand)
    const after = run(state, { type: 'MOVE', uid: a, to: 'active' }, { type: 'MOVE', uid: b, to: 'bench' })
    expect(after.player.active).toMatchObject({ id: 'p1', enteredPlayOnTurn: 3, damage: 0 })
    expect(after.player.bench[0]).toMatchObject({ id: 'p2', enteredPlayOnTurn: 3 })
    expect(allPokemonInPlay(after).map((s) => s.id)).toEqual(['p1', 'p2'])
  })

  it('only logs when moving to an occupied Active Spot', () => {
    const state = playing()
    const [a, b] = uids(state.player.hand)
    const placed = reduce(state, { type: 'MOVE', uid: a, to: 'active' })
    const after = reduce(placed, { type: 'MOVE', uid: b, to: 'active' })
    expect(after.player).toBe(placed.player)
    expect(lastLog(after)).toMatch(/^Can't move .* to the Active Spot: it is occupied\./)
  })

  it('always allows another Benched Pokémon', () => {
    const state = playing()
    const after = state.player.hand.reduce((s, c) => reduce(s, { type: 'MOVE', uid: c.uid, to: 'bench' }), state)
    expect(after.player.bench).toHaveLength(7)
  })

  it('discards the old Stadium when a new one is moved in', () => {
    const state = playing()
    const [a, b] = uids(state.player.hand)
    const after = run(state, { type: 'MOVE', uid: a, to: 'stadium' }, { type: 'MOVE', uid: b, to: 'stadium' })
    expect(after.player.stadium?.uid).toBe(b)
    expect(uids(after.player.discard)).toEqual([a])
    expect(lastLog(after)).toMatch(/was discarded\)\.$/)
    assertConservation(after)
  })

  it('removes the Pokémon when its only card leaves play', () => {
    const { state, uid } = withCardIn('active')
    const after = reduce(state, { type: 'MOVE', uid, to: 'hand' })
    expect(after.player.active).toBeNull()
    expect(findInPlay(after, uid)).toBeNull()
  })

  it('counts a card moved out of the Prize cards as a Prize taken', () => {
    const state = playing()
    const after = reduce(state, { type: 'MOVE', uid: state.player.prizes[0].uid, to: 'discard' })
    expect(after.prizesTaken).toBe(1)
    expect(after.player.prizes).toHaveLength(5)
  })
})

describe('SHUFFLE_DECK', () => {
  it('reorders the deck, advances the rng and keeps every card', () => {
    const before = playing()
    const after = reduce(before, { type: 'SHUFFLE_DECK' })
    expect(uids(after.player.deck)).not.toEqual(uids(before.player.deck))
    expect(uids(after.player.deck).sort()).toEqual(uids(before.player.deck).sort())
    expect(after.rng).not.toBe(before.rng)
    expect(after.player.hand).toBe(before.player.hand)
    expect(reduce(before, { type: 'SHUFFLE_DECK' })).toEqual(after)
  })
})

describe('PUT_ON_BOTTOM', () => {
  it('puts cards on the bottom of the deck in the given order', () => {
    const state = playing()
    const [a, b, c] = uids(state.player.hand)
    const after = reduce(state, { type: 'PUT_ON_BOTTOM', uids: [c, a, b] })
    expect(uids(after.player.deck.slice(-3))).toEqual([c, a, b])
    expect(uids(after.player.deck.slice(0, 47))).toEqual(uids(state.player.deck))
    expect(after.player.hand).toHaveLength(4)
    expect(lastLog(after)).toBe('Put 3 cards on the bottom of the deck.')
    assertConservation(after)
  })

  it('works on cards already in the deck, skips unknown uids and ignores repeats', () => {
    const state = playing()
    const top = state.player.deck[0].uid
    const after = reduce(state, { type: 'PUT_ON_BOTTOM', uids: [top, 'nope#1', top] })
    expect(after.player.deck[after.player.deck.length - 1].uid).toBe(top)
    expect(after.player.deck).toHaveLength(47)
    expect(lastLog(after)).toBe('Put 1 card on the bottom of the deck.')
  })
})

describe('TAKE_PRIZE', () => {
  it('moves a prize to the hand and increments prizesTaken', () => {
    const state = playing()
    const uid = state.player.prizes[2].uid
    const after = reduce(state, { type: 'TAKE_PRIZE', uid })
    expect(locate(after, uid)?.zone).toBe('hand')
    expect(after.prizesTaken).toBe(1)
    expect(after.player.prizes).toHaveLength(5)
    expect(lastLog(after)).toMatch(/^Took a Prize card: .*\. 5 Prize cards left\.$/)
  })

  it('is a no-op (same reference) for a card that is not a prize', () => {
    const state = playing()
    expect(reduce(state, { type: 'TAKE_PRIZE', uid: state.player.hand[0].uid })).toBe(state)
  })
})

describe('FLIP_COIN', () => {
  it('logs the result, advances the rng and changes nothing else', () => {
    const before = playing()
    const after = reduce(before, { type: 'FLIP_COIN' })
    expect(lastLog(after)).toMatch(/^Coin flip: (heads|tails)\.$/)
    expect(after.rng).not.toBe(before.rng)
    expect(after.player).toBe(before.player)
    expect(reduce(before, { type: 'FLIP_COIN' })).toEqual(after)
  })

  it('gives both results over a run of flips', () => {
    let state = playing()
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      state = reduce(state, { type: 'FLIP_COIN' })
      seen.add(lastLog(state))
    }
    expect(seen.size).toBe(2)
  })
})

describe('END_TURN', () => {
  it('advances the turn, resets turnCounts and leaves everything else alone', () => {
    const base = playing()
    const before: GameState = { ...base, turnCounts: { energyAttached: 1, supportersPlayed: 2, retreats: 1, stadiumsPlayed: 1 } }
    const after = reduce(before, { type: 'END_TURN' })
    expect(after.turn).toBe(2)
    expect(after.turnCounts).toEqual({ energyAttached: 0, supportersPlayed: 0, retreats: 0, stadiumsPlayed: 0 })
    expect(lastLog(after)).toBe('Turn 2.')
    expect({ ...after, turn: before.turn, turnCounts: before.turnCounts, log: before.log }).toEqual(before)
    expect(after.player).toBe(before.player)
  })

  it('is a no-op (same reference) during setup', () => {
    const state = setup()
    expect(reduce(state, { type: 'END_TURN' })).toBe(state)
  })
})

describe('RESET', () => {
  it('rebuilds a fresh game from the same deck with the given seed', () => {
    const played = run(playing(), { type: 'DRAW', count: 5 }, { type: 'END_TURN' })
    expect(reduce(played, { type: 'RESET', seed: 42 })).toEqual(createGame(played.deckEntries, 42))
  })

  it('uses the next rng value when no seed is given, so it stays deterministic', () => {
    const played = run(playing(), { type: 'DRAW', count: 5 })
    const a = reduce(played, { type: 'RESET' })
    expect(a).toEqual(reduce(played, { type: 'RESET' }))
    expect(a).toMatchObject({ phase: 'setup', turn: 0, mulligans: 0, prizesTaken: 0 })
    expect(a.player.hand).toHaveLength(7)
    expect(uids(a.player.hand)).not.toEqual(uids(setup().player.hand))
    assertConservation(a)
  })
})

describe('selectors', () => {
  it('locate finds cards in stacks and attachments, and findInPlay accepts a slot id or any card uid', () => {
    const { state, uid } = withCardIn('bench')
    const slot = state.player.bench[0]
    const energy = state.player.deck[0]
    const withAttachment: GameState = { ...state, player: { ...state.player, deck: state.player.deck.slice(1), bench: [{ ...slot, attached: [energy] }] } }
    expect(locate(withAttachment, uid)).toMatchObject({ zone: 'bench', where: 'stack', slotId: slot.id })
    expect(locate(withAttachment, energy.uid)).toMatchObject({ zone: 'bench', where: 'attached', slotId: slot.id })
    expect(locate(withAttachment, 'nope#1')).toBeNull()
    expect(findInPlay(withAttachment, slot.id)?.id).toBe(slot.id)
    expect(findInPlay(withAttachment, uid)?.id).toBe(slot.id)
    expect(findInPlay(withAttachment, energy.uid)?.id).toBe(slot.id)
    expect(findInPlay(withAttachment, 'nope#1')).toBeNull()
  })

  it('sends attachments to the discard pile when the last card of a stack leaves play', () => {
    const { state, uid } = withCardIn('bench')
    const slot = state.player.bench[0]
    const [e1, e2] = state.player.deck
    const loaded: GameState = { ...state, player: { ...state.player, deck: state.player.deck.slice(2), bench: [{ ...slot, attached: [e1, e2] }] } }
    assertConservation(loaded)
    const after = reduce(loaded, { type: 'MOVE', uid, to: 'hand' })
    expect(after.player.bench).toEqual([])
    expect(uids(after.player.discard)).toEqual([e1.uid, e2.uid])
    expect(lastLog(after)).toMatch(/\(2 attached cards went to the discard pile\)\.$/)
    assertConservation(after)
  })

  it('keeps the slot id when one card of a taller stack leaves play', () => {
    const { state, uid } = withCardIn('bench')
    const slot = state.player.bench[0]
    const upper = state.player.deck[0]
    const stacked: GameState = { ...state, player: { ...state.player, deck: state.player.deck.slice(1), bench: [{ ...slot, stack: [...slot.stack, upper] }] } }
    const after = reduce(stacked, { type: 'MOVE', uid, to: 'discard' })
    expect(after.player.bench).toHaveLength(1)
    expect(after.player.bench[0].id).toBe(slot.id)
    expect(uids(after.player.bench[0].stack)).toEqual([upper.uid])
    assertConservation(after)
  })

  it('hasBasicInHand reflects the hand', () => {
    const state = setup()
    const noBasics: GameState = { ...state, player: { ...state.player, hand: state.player.hand.filter((c) => c.card.stage !== 'Basic') } }
    expect(hasBasicInHand(noBasics)).toBe(false)
    const basic = [...state.player.hand, ...state.player.deck].find((c) => c.card.stage === 'Basic')!
    expect(hasBasicInHand({ ...noBasics, player: { ...noBasics.player, hand: [basic] } })).toBe(true)
  })
})

describe('invariants', () => {
  it('collectUids sees every zone', () => {
    const state = run(playing(), { type: 'DRAW', count: 2 })
    const [a, b, c, d] = uids(state.player.hand)
    const spread = run(state, { type: 'MOVE', uid: a, to: 'active' }, { type: 'MOVE', uid: b, to: 'bench' }, { type: 'MOVE', uid: c, to: 'stadium' }, { type: 'MOVE', uid: d, to: 'lostZone' })
    expect(collectUids(spread)).toHaveLength(60)
    assertConservation(spread)
  })

  it('assertConservation throws for a lost or duplicated card', () => {
    const state = playing()
    const lost: GameState = { ...state, player: { ...state.player, hand: state.player.hand.slice(1) } }
    const duplicated: GameState = { ...state, player: { ...state.player, hand: [...state.player.hand, state.player.hand[0]] } }
    expect(() => assertConservation(lost)).toThrow(/Missing: \[.+\]/)
    expect(() => assertConservation(duplicated)).toThrow(/duplicated: \[.+\]/)
  })

  it('same seed and same actions give an identical final state', () => {
    const play = () => {
      const s = playing(123)
      return run(s, { type: 'DRAW', count: 1 }, { type: 'MOVE', uid: s.player.hand[0].uid, to: 'active' }, { type: 'FLIP_COIN' }, { type: 'SHUFFLE_DECK' }, { type: 'TAKE_PRIZE', uid: s.player.prizes[0].uid }, { type: 'END_TURN' })
    }
    expect(play()).toEqual(play())
  })
})
