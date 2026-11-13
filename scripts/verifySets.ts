// npm run verify:sets
// Re-checks every entry in STANDARD_SETS against TCGdex and lists current-series sets that are
// neither in STANDARD_SETS nor in EXCLUDED_SETS (i.e. new releases that need a decision).

import { EXCLUDED_SETS, STANDARD_MARKS, STANDARD_SETS, STANDARD_SET_IDS } from '../src/data/standardSets'
import { getCard, getSet, listSeriesSets, searchCards } from '../src/lib/cards'

const SERIES = ['sv', 'me']
const MARKS = 'DEFGHIJKLM'.split('')

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const setIdOf = (cardId: string) => cardId.slice(0, cardId.lastIndexOf('-'))

async function rawLegalStandard(cardId: string): Promise<boolean | undefined> {
  const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`)
  const json = (await res.json()) as { legal?: { standard?: boolean } }
  return json.legal?.standard
}

async function main() {
  let problems = 0

  // One query per mark across all listed sets, bucketed by set: counts[setId][mark]
  const counts = new Map<string, Map<string, number>>()
  for (const mark of MARKS) {
    const cards = await searchCards({}, { setIds: STANDARD_SET_IDS, marks: [mark] })
    for (const c of cards) {
      const bySet = counts.get(setIdOf(c.id)) ?? new Map<string, number>()
      bySet.set(mark, (bySet.get(mark) ?? 0) + 1)
      counts.set(setIdOf(c.id), bySet)
    }
  }

  console.log(
    `${pad('id', 9)}| ${pad('name', 26)}| ${pad('abbr', 5)}| ${pad('released', 11)}| ${pad('marks (count)', 22)}| ${pad('sample Pokémon', 34)}| status`,
  )
  for (const entry of STANDARD_SETS) {
    try {
      const set = await getSet(entry.id)
      const marks = [...(counts.get(entry.id) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1])
      const majority = marks[0]?.[0] ?? null
      const marked = marks.reduce((n, [, c]) => n + c, 0)
      const rotated = marks.filter(([m]) => !STANDARD_MARKS.includes(m)).reduce((n, [, c]) => n + c, 0)

      // Sample a Pokémon from the middle of the set, not card 001.
      const pokemon = await searchCards({ category: 'Pokemon' }, { setIds: [entry.id] })
      const pick = pokemon[Math.floor(pokemon.length / 2)]
      let sample = '-'
      if (pick) {
        const card = await getCard(pick.id)
        sample = `${card.id} ${card.name} | ${card.regulationMark ?? '-'} | ${await rawLegalStandard(card.id)}`
      }

      const issues: string[] = []
      if (set.name !== entry.name) issues.push(`name is "${set.name}"`)
      if ((set.abbr ?? '') !== entry.abbr) issues.push(`abbr is "${set.abbr ?? ''}"`)
      if (majority !== entry.mark) issues.push(`majority mark is ${majority ?? 'none'}, file says ${entry.mark ?? 'null'}`)
      if (majority && !STANDARD_MARKS.includes(majority)) issues.push(`majority mark ${majority} is not in STANDARD_MARKS`)
      if (entry.verified !== (majority != null && majority === entry.mark)) issues.push(`verified should be ${!entry.verified}`)
      if (issues.length) problems++

      const info: string[] = []
      if (rotated) info.push(`${rotated} card(s) with rotated marks (handled by the mark rule)`)
      if (marked < set.cards.length && marked > 0) info.push(`${set.cards.length - marked} unmarked`)
      if (marked === 0 && pokemon.length) info.push('no marks in API: legality rests on this file')
      console.log(
        `${pad(entry.id, 9)}| ${pad(set.name, 26)}| ${pad(set.abbr ?? '', 5)}| ${pad(set.releaseDate ?? '', 11)}| ${pad(marks.map(([m, c]) => `${m}(${c})`).join(' ') || '-', 22)}| ${pad(sample, 34)}| ${issues.length ? 'CHECK: ' + issues.join('; ') : 'ok'}${info.length ? ' — ' + info.join('; ') : ''}`,
      )
    } catch (err) {
      problems++
      console.log(`${pad(entry.id, 9)}| ERROR: ${(err as Error).message}`)
    }
  }

  console.log('\nCurrent-series sets not in STANDARD_SETS:')
  const known = new Set(STANDARD_SET_IDS)
  for (const serie of SERIES) {
    for (const s of await listSeriesSets(serie)) {
      if (known.has(s.id)) continue
      const reason = EXCLUDED_SETS[s.id]
      if (!reason) problems++
      console.log(`  ${pad(s.id, 9)}| ${pad(s.name, 26)}| ${reason ? `excluded: ${reason}` : 'NEW? not listed and not excluded — review'}`)
    }
  }

  console.log(problems ? `\n${problems} item(s) need attention.` : '\nAll entries match the API.')
  process.exit(problems ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
