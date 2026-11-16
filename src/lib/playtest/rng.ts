// Seeded randomness for the playtest engine. Everything is state-in/state-out: each function takes
// a seed and returns the next seed, so the reducer stays pure and a game replays exactly.
// Seeds are unsigned 32-bit integers.

/** One mulberry32 step: a value in [0, 1) and the next seed. */
export function mulberry32(seed: number): { value: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0
  let t = next
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next }
}

/** Fisher–Yates on a copy. The input array is not modified. */
export function shuffle<T>(cards: readonly T[], seed: number): { cards: T[]; seed: number } {
  const out = cards.slice()
  let s = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    const step = mulberry32(s)
    s = step.seed
    const j = Math.floor(step.value * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return { cards: out, seed: s }
}

export function flipCoin(seed: number): { heads: boolean; seed: number } {
  const step = mulberry32(seed >>> 0)
  return { heads: step.value < 0.5, seed: step.seed }
}

/** A fresh seed from the platform's crypto source. Impure: call it from the store, never from the reducer. */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}
