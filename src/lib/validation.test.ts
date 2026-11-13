import { describe, expect, it } from 'vitest'
import { buildReprintNames } from './legality'
import { basicEnergy, entry, legalDeck, pokemon, trainer } from './testUtils'
import { canAddCopy, validateDeck, type DeckEntry } from './validation'

const ctx = { reprintNames: buildReprintNames([{ name: 'Ultra Ball' }]), aceSpecNames: new Set(['prime catcher']) }
const codes = (entries: DeckEntry[]) => validateDeck(entries, ctx).errors.map((e) => e.code)
const OLD = { regulationMark: 'F', set: { id: 'swsh9', name: 'Brilliant Stars' } }

/** Swap `n` basic Energy out of the legal deck for the given entries, keeping 60 cards. */
function deckWith(extra: DeckEntry[]): DeckEntry[] {
  const deck = legalDeck()
  const energy = deck[deck.length - 1]
  energy.count -= extra.reduce((n, e) => n + e.count, 0)
  return [...deck, ...extra]
}

describe('validateDeck', () => {
  it('passes a legal 60-card deck', () => {
    const result = validateDeck(legalDeck(), ctx)
    expect(result).toMatchObject({ total: 60, errors: [], valid: true })
  })

  it('flags 59 and 61 cards', () => {
    const short = legalDeck()
    short[short.length - 1].count = 19
    const long = legalDeck()
    long[long.length - 1].count = 21
    expect(codes(short)).toEqual(['deck-size'])
    expect(validateDeck(short, ctx).errors[0].message).toContain('add 1 more')
    expect(codes(long)).toEqual(['deck-size'])
    expect(validateDeck(long, ctx).errors[0].message).toContain('remove 1')
  })

  it('allows 4 copies and flags 5', () => {
    expect(codes(deckWith([entry(trainer('Ultra Ball'), 4)]))).toEqual([])
    expect(codes(deckWith([entry(trainer('Ultra Ball'), 5)]))).toEqual(['too-many-copies'])
  })

  it('counts the same name across two sets', () => {
    const a = trainer('Ultra Ball')
    const b = trainer('Ultra Ball', { id: 'me01-120', set: { id: 'me01', name: 'Mega Evolution' } })
    const result = validateDeck(deckWith([entry(a, 3), entry(b, 2)]), ctx)
    expect(result.errors.map((e) => e.code)).toEqual(['too-many-copies'])
    expect(result.errors[0].cardIds).toEqual([a.id, b.id])
  })

  it('exempts basic Energy from the copy limit', () => {
    expect(codes(legalDeck())).not.toContain('too-many-copies')
  })

  it('does not exempt special Energy', () => {
    const special = pokemon('Mist Energy', { category: 'Energy', energyType: 'Special', stage: undefined })
    expect(codes(deckWith([entry(special, 5)]))).toEqual(['too-many-copies'])
  })

  it('requires a Basic Pokémon', () => {
    const deck = [entry(pokemon('Charizard ex', { stage: 'Stage2' }), 4), entry(basicEnergy(), 56)]
    expect(codes(deck)).toEqual(['no-basic-pokemon'])
  })

  it('flags each card that is not Standard legal', () => {
    const old = pokemon('Arceus V', OLD)
    const result = validateDeck(deckWith([entry(old, 2)]), ctx)
    expect(result.errors.map((e) => e.code)).toEqual(['not-standard-legal'])
    expect(result.errors[0].message).toContain('Arceus V')
    expect(result.errors[0].cardIds).toEqual([old.id])
  })

  it('accepts an old-set Trainer reprint', () => {
    expect(codes(deckWith([entry(trainer('Ultra Ball', OLD), 4)]))).toEqual([])
  })

  it('limits ACE SPEC cards to 1, by rarity or by name', () => {
    const prime = trainer('Prime Catcher', { rarity: 'ACE SPEC Rare' })
    const laser = trainer('Dangerous Laser', { rarity: 'ACE SPEC Rare' })
    const primePromo = trainer('Prime Catcher', { id: 'sv08.5-119', rarity: 'Promo' })
    expect(codes(deckWith([entry(prime, 1)]))).toEqual([])
    expect(codes(deckWith([entry(prime, 2)]))).toEqual(['ace-spec-limit'])
    expect(codes(deckWith([entry(prime, 1), entry(laser, 1)]))).toEqual(['ace-spec-limit'])
    expect(codes(deckWith([entry(primePromo, 1), entry(laser, 1)]))).toEqual(['ace-spec-limit'])
  })

  it('warns, but does not error, on cards from a set with a legality note', () => {
    const card = pokemon('Heracross', { id: 'me06-001', regulationMark: undefined, set: { id: 'me06', name: 'Delta Reign' } })
    const result = validateDeck(deckWith([entry(card, 1)]), ctx)
    expect(result.errors).toEqual([])
    expect(result.warnings.map((w) => w.code)).toEqual(['unverified-legality'])
  })

  it('reports nothing but size for an empty deck', () => {
    expect(codes([])).toEqual(['deck-size'])
  })
})

describe('canAddCopy', () => {
  it('stops at 4 by name across printings, never for basic Energy', () => {
    const a = trainer('Ultra Ball')
    const b = trainer('Ultra Ball', { id: 'me01-120' })
    expect(canAddCopy([entry(a, 3)], b, ctx)).toBe(true)
    expect(canAddCopy([entry(a, 3), entry(b, 1)], b, ctx)).toBe(false)
    expect(canAddCopy([entry(basicEnergy(), 30)], basicEnergy(), ctx)).toBe(true)
  })

  it('stops a second ACE SPEC', () => {
    const prime = trainer('Prime Catcher', { rarity: 'ACE SPEC Rare' })
    const laser = trainer('Dangerous Laser', { rarity: 'ACE SPEC Rare' })
    expect(canAddCopy([entry(prime, 1)], laser, ctx)).toBe(false)
  })
})
