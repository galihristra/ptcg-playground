// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { flipCoin, mulberry32, randomSeed, shuffle } from './rng'

const isUint32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('mulberry32', () => {
  it('is deterministic and returns values in [0, 1) with uint32 seeds', () => {
    let seed = 123456789
    for (let i = 0; i < 1000; i++) {
      const a = mulberry32(seed)
      expect(mulberry32(seed)).toEqual(a)
      expect(a.value).toBeGreaterThanOrEqual(0)
      expect(a.value).toBeLessThan(1)
      expect(isUint32(a.seed)).toBe(true)
      seed = a.seed
    }
  })

  it('wraps the seed at 32 bits', () => {
    expect(isUint32(mulberry32(0xffffffff).seed)).toBe(true)
    expect(mulberry32(0xffffffff).seed).toBe(0x6d2b79f4)
  })
})

describe('shuffle', () => {
  it('gives the same order for the same seed', () => {
    expect(shuffle(range(60), 42)).toEqual(shuffle(range(60), 42))
  })

  it('gives a different order for a different seed', () => {
    expect(shuffle(range(60), 1).cards).not.toEqual(shuffle(range(60), 2).cards)
  })

  it('returns a permutation and does not mutate the input', () => {
    const input = range(60)
    const { cards, seed } = shuffle(input, 7)
    expect(input).toEqual(range(60))
    expect(cards).not.toBe(input)
    expect(cards).not.toEqual(input)
    expect(cards.slice().sort((a, b) => a - b)).toEqual(input)
    expect(isUint32(seed)).toBe(true)
  })

  it('advances the seed, so shuffling again gives a new order', () => {
    const first = shuffle(range(60), 7)
    const second = shuffle(range(60), first.seed)
    expect(first.seed).not.toBe(7)
    expect(second.cards).not.toEqual(first.cards)
  })

  it('handles empty and single-card arrays without consuming randomness', () => {
    expect(shuffle([], 5)).toEqual({ cards: [], seed: 5 })
    expect(shuffle(['a'], 5)).toEqual({ cards: ['a'], seed: 5 })
  })

  it('puts every card in every position about equally often', () => {
    const counts = range(4).map(() => range(4).map(() => 0))
    let seed = 99
    const runs = 20_000
    for (let i = 0; i < runs; i++) {
      const r = shuffle(range(4), seed)
      seed = r.seed
      r.cards.forEach((card, pos) => counts[card][pos]++)
    }
    for (const row of counts) for (const c of row) expect(Math.abs(c / runs - 0.25)).toBeLessThan(0.02)
  })
})

describe('flipCoin', () => {
  it('is deterministic for a seed and advances it', () => {
    expect(flipCoin(10)).toEqual(flipCoin(10))
    expect(flipCoin(10).seed).not.toBe(10)
  })

  it('lands heads about half the time over 10,000 flips', () => {
    let seed = 2026
    let heads = 0
    for (let i = 0; i < 10_000; i++) {
      const flip = flipCoin(seed)
      seed = flip.seed
      if (flip.heads) heads++
    }
    expect(Math.abs(heads / 10_000 - 0.5)).toBeLessThan(0.02)
  })
})

describe('randomSeed', () => {
  it('returns an unsigned 32-bit integer', () => {
    for (let i = 0; i < 20; i++) expect(isUint32(randomSeed())).toBe(true)
  })
})
