// Set abbreviation lookups for decklists. Standard sets come from the static list; other sets
// are fetched once and remembered so an exported list can be imported again later.

import { getStandardSet, standardSetByAbbr } from '../../data/standardSets'
import { getSet } from '../../lib/cards'

const KEY = 'poke-deckbuilder:set-abbr'

function readLearned(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** setId -> abbreviation for sets outside Standard */
const learned: Record<string, string> = readLearned()

export function abbrForSet(setId: string): string | undefined {
  return getStandardSet(setId)?.abbr || learned[setId]
}

export function setIdForAbbr(abbr: string): string | undefined {
  const upper = abbr.toUpperCase()
  return standardSetByAbbr(upper)?.id ?? Object.keys(learned).find((id) => learned[id].toUpperCase() === upper)
}

/** Makes sure abbreviations for these sets are known (fetching non-Standard ones). */
export async function ensureAbbrs(setIds: string[]): Promise<void> {
  const missing = [...new Set(setIds)].filter((id) => !abbrForSet(id))
  await Promise.all(
    missing.map(async (id) => {
      try {
        const abbr = (await getSet(id)).abbr
        if (abbr) learned[id] = abbr
      } catch {
        // exported without set/number; import falls back to the name
      }
    }),
  )
  try {
    localStorage.setItem(KEY, JSON.stringify(learned))
  } catch {
    // ignore
  }
}
