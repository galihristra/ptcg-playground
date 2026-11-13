// Turns parsed decklist lines into real cards. Network access is injected so this stays testable.

import { standardSetOrder } from '../data/standardSets'
import type { ParsedDecklist } from './decklist'
import { normalizeName } from './legality'
import type { Card, CardBrief } from './types'
import type { DeckEntry } from './validation'

export interface ResolveDeps {
  getCard: (id: string) => Promise<Card>
  /** Cards whose name contains `name` (any set). */
  searchByName: (name: string) => Promise<CardBrief[]>
  setIdForAbbr: (abbr: string) => string | undefined
}

export interface UnmatchedLine {
  line: number
  raw: string
  reason: string
}

export interface ResolveResult {
  entries: DeckEntry[]
  unmatched: UnmatchedLine[]
}

export const setIdOfCard = (cardId: string) => cardId.slice(0, cardId.lastIndexOf('-'))

function candidateIds(setId: string, number: string): string[] {
  const ids = [`${setId}-${number}`]
  if (/^\d+$/.test(number)) ids.unshift(`${setId}-${number.padStart(3, '0')}`)
  return [...new Set(ids)]
}

function sameName(a: string, b: string): boolean {
  const strip = (s: string) => normalizeName(s).replace(/^basic /, '')
  return strip(a) === strip(b)
}

async function bySetAndNumber(setId: string, number: string, deps: ResolveDeps): Promise<Card | undefined> {
  for (const id of candidateIds(setId, number)) {
    try {
      return await deps.getCard(id)
    } catch {
      // try the next id form, then fall back to name
    }
  }
  return undefined
}

async function byName(name: string, deps: ResolveDeps): Promise<Card | undefined> {
  const briefs = (await deps.searchByName(name)).filter((b) => sameName(b.name, name))
  if (briefs.length === 0) return undefined
  // Prefer the most recent Standard printing; otherwise the first printing found.
  const best = briefs.reduce((a, b) => (standardSetOrder(setIdOfCard(b.id)) > standardSetOrder(setIdOfCard(a.id)) ? b : a))
  return deps.getCard(best.id)
}

export async function resolveDecklist(parsed: ParsedDecklist, deps: ResolveDeps): Promise<ResolveResult> {
  const byId = new Map<string, DeckEntry>()
  const unmatched: UnmatchedLine[] = parsed.unparsed.map((u) => ({ ...u, reason: 'Not a card line' }))

  const resolved = await Promise.all(
    parsed.lines.map(async (line) => {
      try {
        let card: Card | undefined
        const setId = line.setAbbr ? deps.setIdForAbbr(line.setAbbr) : undefined
        if (setId && line.number) card = await bySetAndNumber(setId, line.number, deps)
        if (!card) card = await byName(line.name, deps)
        return { line, card, error: undefined as string | undefined }
      } catch (err) {
        return { line, card: undefined, error: (err as Error).message }
      }
    }),
  )

  for (const { line, card, error } of resolved) {
    if (!card) {
      unmatched.push({ line: line.line, raw: line.raw, reason: error ? `Lookup failed: ${error}` : 'No matching card found' })
      continue
    }
    const existing = byId.get(card.id)
    if (existing) existing.count += line.count
    else byId.set(card.id, { card, count: line.count })
  }

  unmatched.sort((a, b) => a.line - b.line)
  return { entries: [...byId.values()], unmatched }
}
