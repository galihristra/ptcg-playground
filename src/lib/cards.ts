import { Query } from '@tcgdex/sdk'
import { tcgdex } from './tcgdex'
import type { Card, CardBrief, CardFilters, Category } from './types'

// ---------- retry ----------

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Retries a flaky call with exponential backoff (TCGdex sometimes answers "no available server"). */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 400, sleep = defaultSleep } = opts
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

// ---------- SDK -> own types ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>

export function toBrief(raw: Raw): CardBrief {
  return { id: raw.id, localId: String(raw.localId), name: raw.name, image: raw.image || undefined }
}

export function toCard(raw: Raw): Card {
  return {
    ...toBrief(raw),
    category: raw.category as Category,
    set: { id: raw.set?.id, name: raw.set?.name },
    rarity: raw.rarity,
    hp: typeof raw.hp === 'number' ? raw.hp : undefined,
    types: raw.types,
    stage: raw.stage,
    suffix: raw.suffix,
    regulationMark: raw.regulationMark,
    energyType: raw.energyType,
    trainerType: raw.trainerType,
    effect: raw.effect,
    attacks: raw.attacks?.map((a: Raw) => ({ name: a.name, cost: a.cost, damage: a.damage, effect: a.effect })),
    abilities: raw.abilities?.map((a: Raw) => ({ name: a.name, type: a.type, effect: a.effect })),
    retreat: raw.retreat,
    illustrator: raw.illustrator,
  }
}

// ---------- queries ----------

export interface SearchOptions {
  /** Restrict to these set ids (exact match, OR-ed server-side). */
  setIds?: string[]
  /** Restrict to cards carrying one of these regulation marks. */
  marks?: string[]
  page?: number
  perPage?: number
}

export function buildQuery(filters: CardFilters, opts: SearchOptions = {}): Query {
  const q = Query.create()
  const name = filters.name?.trim()
  if (name) q.contains('name', name)
  if (filters.category) q.equal('category', filters.category)
  if (filters.type) q.contains('types', filters.type)
  if (filters.stage) q.equal('stage', filters.stage)
  if (filters.hpMin != null) q.greaterOrEqualThan('hp', filters.hpMin)
  if (filters.hpMax != null) q.lesserOrEqualThan('hp', filters.hpMax)
  if (filters.rarity) q.equal('rarity', filters.rarity)
  if (filters.setId) q.equal('set.id', filters.setId)
  else if (opts.setIds?.length) q.equal('set.id', opts.setIds.join('|'))
  if (opts.marks?.length) q.equal('regulationMark', opts.marks.join('|'))
  if (opts.page != null) q.paginate(opts.page, opts.perPage ?? 100)
  return q
}

export async function searchCards(filters: CardFilters, opts: SearchOptions = {}): Promise<CardBrief[]> {
  const list = await withRetry(() => tcgdex.card.list(buildQuery(filters, opts)))
  return (list ?? []).map(toBrief)
}

const cardCache = new Map<string, Promise<Card>>()

/** Full card detail, de-duplicated and cached in memory for the session. */
export function getCard(id: string): Promise<Card> {
  let hit = cardCache.get(id)
  if (!hit) {
    hit = withRetry(async () => {
      const raw = await tcgdex.card.get(id)
      if (!raw) throw new Error(`Card not found: ${id}`)
      return toCard(raw)
    })
    hit.catch(() => cardCache.delete(id))
    cardCache.set(id, hit)
  }
  return hit
}

export interface SetInfo {
  id: string
  name: string
  abbr?: string
  releaseDate?: string
  serieId?: string
  cards: CardBrief[]
}

const setCache = new Map<string, Promise<SetInfo>>()

export function getSet(id: string): Promise<SetInfo> {
  let hit = setCache.get(id)
  if (!hit) {
    hit = withRetry(async () => {
      const raw = (await tcgdex.set.get(id)) as Raw | null
      if (!raw) throw new Error(`Set not found: ${id}`)
      return {
        id: raw.id,
        name: raw.name,
        abbr: raw.abbreviation?.official,
        releaseDate: raw.releaseDate,
        serieId: raw.serie?.id,
        cards: (raw.cards ?? []).map(toBrief),
      }
    })
    hit.catch(() => setCache.delete(id))
    setCache.set(id, hit)
  }
  return hit
}

export interface SetBrief {
  id: string
  name: string
}

export async function listSets(): Promise<SetBrief[]> {
  const list = await withRetry(() => tcgdex.set.list())
  return ((list ?? []) as Raw[]).map((s) => ({ id: s.id, name: s.name }))
}

export async function listSeriesSets(serieId: string): Promise<SetBrief[]> {
  const serie = (await withRetry(() => tcgdex.serie.get(serieId))) as Raw | null
  return ((serie?.sets ?? []) as Raw[]).map((s) => ({ id: s.id, name: s.name }))
}

export async function listRarities(): Promise<string[]> {
  const list = await withRetry(() => tcgdex.fetch('rarities'))
  return (list ?? []) as string[]
}
