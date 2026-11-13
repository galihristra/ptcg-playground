import { describe, expect, it } from 'vitest'
import { CARD_OVERRIDES } from '../data/standardSets'
import { buildReprintNames, checkStandardLegality, isStandardLegal, normalizeName } from './legality'
import { basicEnergy, pokemon, trainer } from './testUtils'

const ctx = { reprintNames: buildReprintNames([{ name: 'Ultra Ball' }, { name: 'Jet Energy' }, { name: 'Pikachu' }]) }
const OLD = { id: 'swsh9-150', localId: '150', regulationMark: 'F', set: { id: 'swsh9', name: 'Brilliant Stars' } }

describe('isStandardLegal', () => {
  it('accepts cards from a Standard set', () => {
    expect(isStandardLegal(pokemon('Raging Bolt ex'), ctx)).toBe(true)
  })

  it('rejects Pokémon from a non-Standard set', () => {
    expect(checkStandardLegality(pokemon('Arceus V', OLD), ctx)).toEqual({ legal: false, reason: 'not-in-standard', note: undefined })
  })

  it('accepts basic Energy from any set', () => {
    const old = basicEnergy('Fire Energy', { id: 'base1-98', set: { id: 'base1', name: 'Base Set' } })
    expect(checkStandardLegality(old, ctx).reason).toBe('basic-energy')
  })

  it('accepts an old-set Trainer whose name is printed in a Standard set (reprint rule)', () => {
    expect(checkStandardLegality(trainer('Ultra Ball', OLD), ctx)).toMatchObject({ legal: true, reason: 'reprint' })
  })

  it('applies the reprint rule to special Energy too', () => {
    const jet = pokemon('Jet Energy', { ...OLD, category: 'Energy', energyType: 'Special' })
    expect(isStandardLegal(jet, ctx)).toBe(true)
  })

  it('does not apply the reprint rule to Pokémon', () => {
    expect(isStandardLegal(pokemon('Pikachu', OLD), ctx)).toBe(false)
  })

  it('rejects an old-set Trainer with no Standard printing', () => {
    expect(isStandardLegal(trainer('Quick Ball', OLD), ctx)).toBe(false)
  })

  it('rejects a card in a Standard set that carries a rotated mark', () => {
    const scovillain = pokemon('Scovillain ex', { regulationMark: 'G' })
    expect(checkStandardLegality(scovillain, ctx)).toMatchObject({ legal: false, reason: 'rotated-mark' })
  })

  it('still accepts a rotated-mark Trainer in a Standard set when the name has a legal printing', () => {
    expect(isStandardLegal(trainer('Ultra Ball', { regulationMark: 'G' }), ctx)).toBe(true)
  })

  it('accepts unmarked cards from a Standard set and surfaces the set note', () => {
    const card = pokemon('Mega Golisopod ex', { id: 'me06-011', regulationMark: undefined, set: { id: 'me06', name: 'Delta Reign' } })
    const result = checkStandardLegality(card, ctx)
    expect(result.legal).toBe(true)
    expect(result.note).toBeTruthy()
  })

  it('lets CARD_OVERRIDES win in both directions', () => {
    const legal = pokemon('Banned Mon')
    const illegal = pokemon('Promo Mon', { id: 'svp-200', set: { id: 'svp', name: 'SVP' } })
    CARD_OVERRIDES[legal.id] = false
    CARD_OVERRIDES[illegal.id] = true
    try {
      expect(isStandardLegal(legal, ctx)).toBe(false)
      expect(isStandardLegal(illegal, ctx)).toBe(true)
    } finally {
      delete CARD_OVERRIDES[legal.id]
      delete CARD_OVERRIDES[illegal.id]
    }
  })
})

describe('normalizeName', () => {
  it('ignores case, accents and apostrophe style', () => {
    expect(normalizeName('Poké Ball')).toBe(normalizeName('poke ball'))
    expect(normalizeName('Professor’s Research')).toBe(normalizeName("Professor's Research"))
  })
})
