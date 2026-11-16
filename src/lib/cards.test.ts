import { describe, expect, it, vi } from 'vitest'
import { toCard, withRetry } from './cards'

describe('withRetry', () => {
  it('retries with exponential backoff, then succeeds', async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const fn = vi.fn().mockRejectedValueOnce(new Error('no available server')).mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok')
    await expect(withRetry(fn, { sleep, baseDelayMs: 100 })).resolves.toBe('ok')
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200])
  })

  it('gives up after the retry budget and rethrows the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('no available server'))
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).rejects.toThrow('no available server')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('toCard', () => {
  const base = { id: 'me01-003', localId: '003', name: 'Mega Venusaur ex', set: { id: 'me01', name: 'Mega Evolution' } }

  it('maps stage, suffix and evolveFrom for an evolved Pokémon', () => {
    const card = toCard({ ...base, category: 'Pokemon', hp: 380, stage: 'Stage2', suffix: 'ex', evolveFrom: 'Ivysaur' })
    expect(card).toMatchObject({ category: 'Pokemon', stage: 'Stage2', suffix: 'ex', evolveFrom: 'Ivysaur', hp: 380 })
  })

  it('leaves evolveFrom undefined when TCGdex has none', () => {
    expect(toCard({ ...base, name: 'Bulbasaur', category: 'Pokemon', stage: 'Basic' }).evolveFrom).toBeUndefined()
    expect(toCard({ ...base, category: 'Pokemon', stage: 'Stage2', evolveFrom: '' }).evolveFrom).toBeUndefined()
  })

  it('maps trainerType', () => {
    expect(toCard({ ...base, name: 'Hero Cape', category: 'Trainer', trainerType: 'Tool' }).trainerType).toBe('Tool')
  })
})
