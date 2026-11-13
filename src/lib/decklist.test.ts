import { describe, expect, it } from 'vitest'
import { standardSetByAbbr, getStandardSet } from '../data/standardSets'
import { basicEnergyLiveName, expandEnergySymbols, parseDecklist, serializeDecklist } from './decklist'
import { resolveDecklist, type ResolveDeps } from './importResolve'
import { basicEnergy, entry, pokemon, trainer } from './testUtils'
import type { Card } from './types'

// Shape of a list copied out of PTCG Live.
const SAMPLE = `Pokémon: 7
4 Raging Bolt ex TEF 123
3 Teal Mask Ogerpon ex TWM 25

Trainer: 6
4 Professor Sada's Vitality PAR 170
1 Prime Catcher TEF 157
1 Pokégear 3.0 SVI 186

Energy: 9
6 Basic {G} Energy SVE 9
3 Basic {L} Energy SVE 12

Total Cards: 22
`

describe('parseDecklist', () => {
  it('parses a PTCG Live export', () => {
    const { lines, unparsed } = parseDecklist(SAMPLE)
    expect(unparsed).toEqual([])
    expect(lines).toHaveLength(7)
    expect(lines[0]).toMatchObject({ count: 4, name: 'Raging Bolt ex', setAbbr: 'TEF', number: '123', line: 2 })
    expect(lines[1]).toMatchObject({ name: 'Teal Mask Ogerpon ex', setAbbr: 'TWM', number: '25' })
    expect(lines[4]).toMatchObject({ name: 'Pokégear 3.0', setAbbr: 'SVI', number: '186' })
    expect(lines[5]).toMatchObject({ count: 6, name: 'Grass Energy', setAbbr: 'SVE', number: '9' })
  })

  it('strips zero padding and accepts name-only lines and "4x"', () => {
    const { lines } = parseDecklist('4 Pikachu ex SSP 057\n2x Iron Hands ex\n1 Ultra Ball')
    expect(lines[0]).toMatchObject({ name: 'Pikachu ex', number: '57' })
    expect(lines[1]).toMatchObject({ count: 2, name: 'Iron Hands ex' })
    expect(lines[1].setAbbr).toBeUndefined()
    expect(lines[2]).toMatchObject({ count: 1, name: 'Ultra Ball' })
    expect(lines[2].setAbbr).toBeUndefined()
  })

  it('reports lines it cannot read instead of dropping them', () => {
    const { lines, unparsed } = parseDecklist('Pokémon: 1\nhello world\n1 Pikachu SSP 57')
    expect(lines).toHaveLength(1)
    expect(unparsed).toEqual([{ line: 2, raw: 'hello world' }])
  })
})

describe('energy names', () => {
  it('converts between TCGdex names and PTCG Live symbols', () => {
    expect(expandEnergySymbols('Basic {D} Energy')).toBe('Darkness Energy')
    expect(basicEnergyLiveName('Grass Energy')).toBe('Basic {G} Energy')
    expect(basicEnergyLiveName('Basic Metal Energy')).toBe('Basic {M} Energy')
  })
})

describe('serialize → parse → resolve round trip', () => {
  const deck = [
    entry(pokemon('Raging Bolt ex', { id: 'sv05-123', localId: '123' }), 4),
    entry(pokemon('Pikachu ex', { id: 'sv08-057', localId: '057', set: { id: 'sv08', name: 'Surging Sparks' } }), 2),
    entry(trainer('Prime Catcher', { id: 'sv05-157', localId: '157' }), 1),
    entry(basicEnergy('Grass Energy', { id: 'sve-009', localId: '009' }), 6),
    entry(basicEnergy('Basic Darkness Energy', { id: 'sv06.5-098', localId: '098', set: { id: 'sv06.5', name: 'Shrouded Fable' } }), 3),
  ]
  const cards = new Map<string, Card>(deck.map((e) => [e.card.id, e.card]))
  const deps: ResolveDeps = {
    getCard: async (id) => {
      const card = cards.get(id)
      if (!card) throw new Error('not found')
      return card
    },
    searchByName: async (name) => [...cards.values()].filter((c) => c.name.toLowerCase().includes(name.toLowerCase())),
    setIdForAbbr: (abbr) => standardSetByAbbr(abbr)?.id,
  }
  const abbrFor = (setId: string) => getStandardSet(setId)?.abbr

  it('writes PTCG Live format with unpadded numbers and section counts', () => {
    const text = serializeDecklist(deck, abbrFor)
    expect(text).toContain('Pokémon: 6\n4 Raging Bolt ex TEF 123\n2 Pikachu ex SSP 57')
    expect(text).toContain('Trainer: 1\n1 Prime Catcher TEF 157')
    expect(text).toContain('Energy: 9\n6 Basic {G} Energy SVE 9\n3 Basic {D} Energy SFA 98')
    expect(text).toContain('Total Cards: 16')
  })

  it('round-trips with zero unmatched lines', async () => {
    const result = await resolveDecklist(parseDecklist(serializeDecklist(deck, abbrFor)), deps)
    expect(result.unmatched).toEqual([])
    expect(result.entries.map((e) => [e.card.id, e.count])).toEqual(deck.map((e) => [e.card.id, e.count]))
  })

  it('falls back to name, preferring the newest Standard printing', async () => {
    const older = trainer('Ultra Ball', { id: 'sv01-196', set: { id: 'sv01', name: 'Scarlet & Violet' } })
    const newer = trainer('Ultra Ball', { id: 'me01-131', set: { id: 'me01', name: 'Mega Evolution' } })
    const mid = trainer('Ultra Ball', { id: 'sv09-150', set: { id: 'sv09', name: 'Journey Together' } })
    for (const c of [older, newer, mid]) cards.set(c.id, c)
    // "SVI" is not a Standard set, so the set+number lookup cannot be used.
    const result = await resolveDecklist(parseDecklist('2 Ultra Ball SVI 196\n1 Ultra Ball'), deps)
    expect(result.unmatched).toEqual([])
    expect(result.entries).toEqual([{ card: newer, count: 3 }])
  })

  it('reports unmatched lines', async () => {
    const result = await resolveDecklist(parseDecklist('1 Missingno TEF 999\nnot a card'), deps)
    expect(result.entries).toEqual([])
    expect(result.unmatched.map((u) => u.line)).toEqual([1, 2])
  })
})
