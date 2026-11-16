// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { basicEnergy, engineDeck, entry, legalDeck, pokemon } from '../testUtils'
import { createGame, expandDeck } from './setup'

const uids = (cards: { uid: string }[]) => cards.map((c) => c.uid)

describe('expandDeck', () => {
  it('creates one instance per copy with unique uids', () => {
    const cards = expandDeck(legalDeck())
    expect(cards).toHaveLength(60)
    expect(new Set(uids(cards)).size).toBe(60)
  })

  it('numbers copies from 1 per card id and keeps the Card reference', () => {
    const mon = pokemon('Pikachu')
    const cards = expandDeck([entry(mon, 3)])
    expect(uids(cards)).toEqual([`${mon.id}#1`, `${mon.id}#2`, `${mon.id}#3`])
    for (const c of cards) expect(c.card).toBe(mon)
  })

  it('has the right number of copies of each card', () => {
    const deck = engineDeck()
    const cards = expandDeck(deck)
    for (const e of deck) expect(cards.filter((c) => c.card.id === e.card.id)).toHaveLength(e.count)
  })

  it('skips entries with a count of zero or less', () => {
    const cards = expandDeck([entry(pokemon('A'), 0), entry(pokemon('B'), -2), entry(pokemon('C'), 2)])
    expect(cards.map((c) => c.card.name)).toEqual(['C', 'C'])
  })

  it('orders by card id whatever order the entries arrive in', () => {
    const deck = engineDeck()
    const reversed = deck.slice().reverse()
    expect(uids(expandDeck(reversed))).toEqual(uids(expandDeck(deck)))
    expect(reversed[0]).toBe(deck[deck.length - 1])
  })

  it('keeps uids unique when two entries share a card id', () => {
    const cards = expandDeck([entry(basicEnergy(), 2), entry(basicEnergy('Fire Energy'), 2)])
    expect(uids(cards)).toEqual(['sve-001#1', 'sve-001#2', 'sve-001#3', 'sve-001#4'])
  })
})

describe('createGame', () => {
  it('draws 7 and leaves 53 in the deck, in the setup phase', () => {
    const game = createGame(legalDeck(), 1)
    expect(game.player.hand).toHaveLength(7)
    expect(game.player.deck).toHaveLength(53)
    expect(game).toMatchObject({ phase: 'setup', turn: 0, goingFirst: null, mulligans: 0, prizesTaken: 0, nextSlot: 1 })
    expect(game.turnCounts).toEqual({ energyAttached: 0, supportersPlayed: 0, retreats: 0, stadiumsPlayed: 0 })
    expect(game.player).toMatchObject({ prizes: [], discard: [], lostZone: [], stadium: null, active: null, bench: [] })
    expect(game.log).toEqual([{ n: 1, text: 'Shuffled the deck (60 cards) and drew 7.' }])
  })

  it('records every uid exactly once across hand and deck', () => {
    const game = createGame(engineDeck(), 5)
    expect(game.initialUids).toHaveLength(60)
    expect(uids([...game.player.hand, ...game.player.deck]).sort()).toEqual(game.initialUids.slice().sort())
  })

  it('is identical for the same deck and seed', () => {
    const deck = engineDeck()
    expect(createGame(deck, 77)).toEqual(createGame(deck, 77))
    expect(uids(createGame(deck.slice().reverse(), 77).player.deck)).toEqual(uids(createGame(deck, 77).player.deck))
  })

  it('gives a different order for a different seed', () => {
    const deck = engineDeck()
    const a = createGame(deck, 1)
    const b = createGame(deck, 2)
    expect(uids([...a.player.hand, ...a.player.deck])).not.toEqual(uids([...b.player.hand, ...b.player.deck]))
  })

  it('actually shuffles and stores the advanced rng state', () => {
    const deck = engineDeck()
    const game = createGame(deck, 9)
    expect(uids([...game.player.hand, ...game.player.deck])).not.toEqual(uids(expandDeck(deck)))
    expect(game.rng).not.toBe(9)
    expect(Number.isInteger(game.rng) && game.rng >= 0 && game.rng <= 0xffffffff).toBe(true)
  })

  it('keeps the deck entries for RESET', () => {
    const deck = engineDeck()
    expect(createGame(deck, 3).deckEntries).toBe(deck)
  })

  it('draws what exists from a 5-card deck and logs it', () => {
    const game = createGame([entry(pokemon('Pikachu'), 4), entry(basicEnergy(), 1)], 4)
    expect(game.player.hand).toHaveLength(5)
    expect(game.player.deck).toHaveLength(0)
    expect(game.log[0].text).toBe('Shuffled the deck. It has only 5 cards, so drew 5 for the opening hand.')
  })

  it('handles an empty deck', () => {
    const game = createGame([], 4)
    expect(game.player.hand).toEqual([])
    expect(game.initialUids).toEqual([])
    expect(game.rng).toBe(4)
  })

  it('is JSON-safe', () => {
    const game = createGame(engineDeck(), 11)
    expect(JSON.parse(JSON.stringify(game))).toEqual(game)
  })
})
