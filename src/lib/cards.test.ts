import { describe, expect, it, vi } from 'vitest'
import { withRetry } from './cards'

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
