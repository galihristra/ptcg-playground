import { describe, expect, it } from 'vitest'
import { engineDeck, pokemon, stage2, trainer } from './testUtils'
import { isBasicPokemon, isMegaEx, isPokemonEx, prizeValue } from './types'

describe('isBasicPokemon', () => {
  it('is true only for Pokémon with stage Basic', () => {
    expect(isBasicPokemon(pokemon('Pikachu'))).toBe(true)
    expect(isBasicPokemon(stage2('Venusaur', 'Ivysaur'))).toBe(false)
    expect(isBasicPokemon(trainer('Basic Ball', { stage: 'Basic' }))).toBe(false)
  })
})

describe('prizeValue', () => {
  it('is 1 for regular Pokémon', () => {
    expect(prizeValue(pokemon('Pikachu'))).toBe(1)
    // A name that merely contains "ex" or starts with "Mega" is not an ex.
    expect(prizeValue(pokemon('Exeggcute'))).toBe(1)
    expect(prizeValue(pokemon('Meganium'))).toBe(1)
  })

  it('is 2 for Pokémon ex, by suffix or by name', () => {
    expect(prizeValue(pokemon('Koraidon ex', { suffix: 'ex' }))).toBe(2)
    expect(prizeValue(pokemon('Koraidon ex'))).toBe(2)
    // TCGdex marks some current ex cards with the old 'EX' suffix (seen in me06).
    expect(prizeValue(pokemon('Talonflame ex', { suffix: 'EX' }))).toBe(2)
  })

  it('is 3 for Mega Evolution Pokémon ex at any stage', () => {
    expect(prizeValue(pokemon('Mega Lucario ex', { suffix: 'ex', stage: 'Stage1', evolveFrom: 'Riolu' }))).toBe(3)
    expect(prizeValue(stage2('Mega Venusaur ex', 'Ivysaur', { suffix: 'ex' }))).toBe(3)
    expect(prizeValue(pokemon('Mega Golisopod ex', { suffix: 'EX' }))).toBe(3)
    expect(isMegaEx(pokemon('Mega Kangaskhan ex', { suffix: 'ex' }))).toBe(true)
  })

  it('never treats Trainers or Energy as ex', () => {
    expect(isPokemonEx(trainer('Professor ex'))).toBe(false)
    expect(prizeValue(trainer('Mega Signal ex'))).toBe(1)
  })
})

describe('engineDeck', () => {
  it('has 60 cards with the documented counts', () => {
    const deck = engineDeck()
    const count = (pred: (e: (typeof deck)[number]) => boolean) => deck.filter(pred).reduce((n, e) => n + e.count, 0)
    expect(count(() => true)).toBe(60)
    expect(count((e) => isBasicPokemon(e.card))).toBe(8)
    expect(count((e) => e.card.stage === 'Stage1')).toBe(4)
    expect(count((e) => e.card.stage === 'Stage2')).toBe(2)
    expect(count((e) => e.card.trainerType === 'Supporter')).toBe(4)
    expect(count((e) => e.card.trainerType === 'Item')).toBe(6)
    expect(count((e) => e.card.trainerType === 'Stadium')).toBe(2)
    expect(count((e) => e.card.trainerType === 'Tool')).toBe(2)
    expect(count((e) => e.card.category === 'Energy')).toBe(32)
  })
})
