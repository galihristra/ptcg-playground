// Derived legality data that needs the network: reprint names, ACE SPEC names and the ids of
// rotated-mark cards inside Standard sets. Cached in localStorage so the app still validates
// decks when TCGdex is down.

import { ROTATED_MARKS, STANDARD_MARKS, STANDARD_SET_IDS } from '../data/standardSets'
import { searchCards } from './cards'
import { buildReprintNames, normalizeName } from './legality'
import { ACE_SPEC_RARITY } from './validation'

export interface StandardData {
  reprintNames: Set<string>
  aceSpecNames: Set<string>
  /** Cards in Standard sets that are not legal (rotated mark, no legal reprint). */
  excludedIds: Set<string>
  fetchedAt: number
  /** true when served from an expired cache because the API could not be reached */
  stale: boolean
}

interface Stored {
  version: string
  fetchedAt: number
  reprintNames: string[]
  aceSpecNames: string[]
  excludedIds: string[]
}

const KEY = 'poke-deckbuilder:standard-data'
const TTL_MS = 24 * 60 * 60 * 1000
// Changing STANDARD_SETS or STANDARD_MARKS invalidates the cache.
const VERSION = `${STANDARD_SET_IDS.join(',')}|${STANDARD_MARKS.join('')}`

function readCache(): Stored | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    return stored && stored.version === VERSION ? stored : undefined
  } catch {
    return undefined
  }
}

function fromStored(s: Stored, stale: boolean): StandardData {
  return {
    reprintNames: new Set(s.reprintNames),
    aceSpecNames: new Set(s.aceSpecNames),
    excludedIds: new Set(s.excludedIds),
    fetchedAt: s.fetchedAt,
    stale,
  }
}

async function fetchStandardData(): Promise<Stored> {
  const [trainers, energies, rotated, aceSpecs] = await Promise.all([
    searchCards({ category: 'Trainer' }, { setIds: STANDARD_SET_IDS }),
    searchCards({ category: 'Energy' }, { setIds: STANDARD_SET_IDS }),
    searchCards({}, { setIds: STANDARD_SET_IDS, marks: ROTATED_MARKS }),
    searchCards({ rarity: ACE_SPEC_RARITY }),
  ])
  const rotatedIds = new Set(rotated.map((c) => c.id))
  const reprintable = [...trainers, ...energies]
  const reprintNames = buildReprintNames(reprintable.filter((c) => !rotatedIds.has(c.id)))
  // A rotated-mark Trainer/Energy is still legal if its name has a legal printing.
  for (const c of reprintable) if (reprintNames.has(normalizeName(c.name))) rotatedIds.delete(c.id)
  return {
    version: VERSION,
    fetchedAt: Date.now(),
    reprintNames: [...reprintNames],
    aceSpecNames: [...buildReprintNames(aceSpecs)],
    excludedIds: [...rotatedIds],
  }
}

export async function loadStandardData(): Promise<StandardData> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return fromStored(cached, false)
  try {
    const fresh = await fetchStandardData()
    try {
      localStorage.setItem(KEY, JSON.stringify(fresh))
    } catch {
      // storage full or unavailable: keep working from memory
    }
    return fromStored(fresh, false)
  } catch (err) {
    if (cached) return fromStored(cached, true)
    throw err
  }
}
