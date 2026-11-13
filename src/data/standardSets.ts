// Hand-maintained list of Standard-legal sets, in release order (oldest first).
// Legality comes from this file, not from the API's `legal.standard` flag, because that flag
// is unreliable for new sets. Run `npm run verify:sets` after editing. See README.

export interface StandardSet {
  /** TCGdex set id */
  id: string
  name: string
  /** Official PTCG Live abbreviation, used for decklist import/export */
  abbr: string
  /** Regulation mark on most of the set's cards; null when the API has no marks for the set */
  mark: string | null
  /** true = `mark` was confirmed against the API by `npm run verify:sets` */
  verified: boolean
  /** Shown as a "legality may be unverified" badge on cards from this set */
  note?: string
}

export const STANDARD_SETS: StandardSet[] = [
  { id: 'sve', name: 'Scarlet & Violet Energy', abbr: 'SVE', mark: null, verified: false },
  { id: 'sv05', name: 'Temporal Forces', abbr: 'TEF', mark: 'H', verified: true },
  { id: 'sv06', name: 'Twilight Masquerade', abbr: 'TWM', mark: 'H', verified: true },
  { id: 'sv06.5', name: 'Shrouded Fable', abbr: 'SFA', mark: 'H', verified: true },
  { id: 'sv07', name: 'Stellar Crown', abbr: 'SCR', mark: 'H', verified: true },
  { id: 'sv08', name: 'Surging Sparks', abbr: 'SSP', mark: 'H', verified: true },
  { id: 'sv08.5', name: 'Prismatic Evolutions', abbr: 'PRE', mark: 'H', verified: true },
  { id: 'sv09', name: 'Journey Together', abbr: 'JTG', mark: 'I', verified: true },
  { id: 'sv10', name: 'Destined Rivals', abbr: 'DRI', mark: 'I', verified: true },
  { id: 'sv10.5b', name: 'Black Bolt', abbr: 'BLK', mark: 'I', verified: true },
  { id: 'sv10.5w', name: 'White Flare', abbr: 'WHT', mark: 'I', verified: true },
  { id: 'mee', name: 'Mega Evolution Energy', abbr: 'MEE', mark: null, verified: false },
  { id: 'me01', name: 'Mega Evolution', abbr: 'MEG', mark: 'I', verified: true },
  { id: 'me02', name: 'Phantasmal Flames', abbr: 'PFL', mark: 'I', verified: true },
  { id: 'me02.5', name: 'Ascended Heroes', abbr: 'ASC', mark: 'I', verified: true },
  { id: 'me03', name: 'Perfect Order', abbr: 'POR', mark: 'J', verified: true },
  { id: 'me04', name: 'Chaos Rising', abbr: 'CRI', mark: 'J', verified: true },
  { id: 'me05', name: 'Pitch Black', abbr: 'PBL', mark: 'J', verified: true },
  { id: 'me06', name: 'Delta Reign', abbr: 'DLR', mark: null, verified: false, note: 'New set: TCGdex has no regulation marks yet and reports legal.standard=false. Check pokemon.com.' },
]

/**
 * Sets from the current series that are deliberately NOT in STANDARD_SETS.
 * `verify:sets` uses this to tell "known and excluded" apart from "new release, please review".
 */
export const EXCLUDED_SETS: Record<string, string> = {
  sv01: 'rotated (mark G)',
  sv02: 'rotated (mark G)',
  sv03: 'rotated (mark G)',
  'sv03.5': 'rotated (mark G)',
  sv04: 'rotated (mark G)',
  'sv04.5': 'rotated (mark G)',
  svp: 'promos: legality is per card, use CARD_OVERRIDES',
  mep: 'promos: legality is per card, use CARD_OVERRIDES',
  '30th': 'classic reprints: legality is per card, undecided',
  '30th-c': 'classic reprints: legality is per card, undecided',
  mfb: 'starter product, printings not reviewed',
}

/**
 * Regulation marks currently legal in Standard. A card in a Standard set that carries an older
 * mark (some sets include reprints with rotated marks, e.g. sv08-252 Jet Energy, mark G) is
 * not legal through its set. Cards with no mark fall back to the set rule.
 */
export const STANDARD_MARKS: string[] = ['H', 'I', 'J']

/** Marks older than the oldest Standard mark, e.g. ['A', ..., 'G']. */
export const ROTATED_MARKS: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .filter((m) => m < [...STANDARD_MARKS].sort()[0])

/** Per-card legality overrides, by TCGdex card id. Wins over every other rule. */
export const CARD_OVERRIDES: Record<string, boolean> = {}

const BY_ID = new Map(STANDARD_SETS.map((s, i) => [s.id, { set: s, order: i }]))
const BY_ABBR = new Map(STANDARD_SETS.filter((s) => s.abbr).map((s) => [s.abbr.toUpperCase(), s]))

export function isStandardSet(setId: string): boolean {
  return BY_ID.has(setId)
}

export function getStandardSet(setId: string): StandardSet | undefined {
  return BY_ID.get(setId)?.set
}

/** Release-order index (higher = newer); -1 for sets not in Standard. */
export function standardSetOrder(setId: string): number {
  return BY_ID.get(setId)?.order ?? -1
}

export function standardSetByAbbr(abbr: string): StandardSet | undefined {
  return BY_ABBR.get(abbr.toUpperCase())
}

export const STANDARD_SET_IDS: string[] = STANDARD_SETS.map((s) => s.id)
