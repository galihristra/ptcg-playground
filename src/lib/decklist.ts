// PTCG Live-style text decklists. Pure: no network, no React.
//
//   Pokémon: 2
//   2 Raging Bolt ex TEF 123
//
//   Trainer: 1
//   1 Prime Catcher TEF 157
//
//   Energy: 1
//   1 Basic {G} Energy SVE 9
//
//   Total Cards: 4

import type { DeckEntry } from './validation'
import { isBasicEnergy, type Category } from './types'

export interface ParsedLine {
  /** 1-based line number in the source text */
  line: number
  raw: string
  count: number
  name: string
  setAbbr?: string
  number?: string
}

export interface ParsedDecklist {
  lines: ParsedLine[]
  /** Non-empty lines that are neither a header nor a card line */
  unparsed: { line: number; raw: string }[]
}

const ENERGY_SYMBOLS: Record<string, string> = {
  G: 'Grass',
  R: 'Fire',
  W: 'Water',
  L: 'Lightning',
  P: 'Psychic',
  F: 'Fighting',
  D: 'Darkness',
  M: 'Metal',
  Y: 'Fairy',
}
const SYMBOL_BY_TYPE = Object.fromEntries(Object.entries(ENERGY_SYMBOLS).map(([k, v]) => [v, k]))

const HEADER = /^(pok[eé]mon|trainers?|energy|energies)\s*(:\s*\d*|\(\d+\))?$/i
const TOTAL = /^total cards\s*:?\s*\d*$/i
const WITH_SET = /^(\d+)x?\s+(.+?)\s+([A-Z][A-Z0-9-]{1,6})\s+([A-Za-z]{0,3}\d+[A-Za-z]{0,2})$/
const NAME_ONLY = /^(\d+)x?\s+(.+)$/

/** "Basic {G} Energy" -> "Grass Energy"; other names unchanged. */
export function expandEnergySymbols(name: string): string {
  const m = /^(?:Basic\s+)?\{([A-Z])\}\s+Energy$/i.exec(name.trim())
  const type = m && ENERGY_SYMBOLS[m[1].toUpperCase()]
  return type ? `${type} Energy` : name.trim()
}

/** "Grass Energy" / "Basic Grass Energy" -> "Basic {G} Energy" (the form PTCG Live exports). */
export function basicEnergyLiveName(name: string): string {
  const m = /^(?:Basic\s+)?(\w+)\s+Energy$/i.exec(name.trim())
  const symbol = m && SYMBOL_BY_TYPE[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()]
  return symbol ? `Basic {${symbol}} Energy` : name
}

/** Collection numbers compare without zero padding: "057" === "57". */
export function normalizeNumber(n: string): string {
  return /^\d+$/.test(n) ? String(parseInt(n, 10)) : n.replace(/^0+(?=\d)/, '').toUpperCase()
}

export function parseDecklist(text: string): ParsedDecklist {
  const lines: ParsedLine[] = []
  const unparsed: ParsedDecklist['unparsed'] = []
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const raw = rawLine.trim()
    if (!raw || HEADER.test(raw) || TOTAL.test(raw)) return
    const withSet = WITH_SET.exec(raw)
    if (withSet) {
      lines.push({
        line: i + 1,
        raw,
        count: Number(withSet[1]),
        name: expandEnergySymbols(withSet[2]),
        setAbbr: withSet[3],
        number: normalizeNumber(withSet[4]),
      })
      return
    }
    const nameOnly = NAME_ONLY.exec(raw)
    if (nameOnly) {
      lines.push({ line: i + 1, raw, count: Number(nameOnly[1]), name: expandEnergySymbols(nameOnly[2]) })
      return
    }
    unparsed.push({ line: i + 1, raw })
  })
  return { lines, unparsed }
}

const SECTIONS: { category: Category; label: string }[] = [
  { category: 'Pokemon', label: 'Pokémon' },
  { category: 'Trainer', label: 'Trainer' },
  { category: 'Energy', label: 'Energy' },
]

/**
 * @param abbrFor returns the official set abbreviation for a set id; when it returns undefined
 *                the line is written without set/number (name only).
 */
export function serializeDecklist(entries: DeckEntry[], abbrFor: (setId: string) => string | undefined): string {
  const blocks: string[] = []
  let total = 0
  for (const { category, label } of SECTIONS) {
    const group = entries.filter((e) => e.card.category === category && e.count > 0)
    if (group.length === 0) continue
    const count = group.reduce((n, e) => n + e.count, 0)
    total += count
    const rows = group.map((e) => {
      const name = isBasicEnergy(e.card) ? basicEnergyLiveName(e.card.name) : e.card.name
      const abbr = abbrFor(e.card.set.id)
      return abbr ? `${e.count} ${name} ${abbr} ${normalizeNumber(e.card.localId)}` : `${e.count} ${name}`
    })
    blocks.push([`${label}: ${count}`, ...rows].join('\n'))
  }
  blocks.push(`Total Cards: ${total}`)
  return blocks.join('\n\n') + '\n'
}
