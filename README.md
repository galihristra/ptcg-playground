# Pokémon TCG Deck Builder

Build and validate Standard-format Pokémon TCG decks in the browser. Card data comes from
[TCGdex](https://tcgdex.dev) through `@tcgdex/sdk`; decks are saved in `localStorage`.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run verify:sets  # check src/data/standardSets.ts against the API
npm run build
```

## What it does

- **Browse**: name, category, type, stage, HP range, set and rarity filters, run server-side.
  "Standard only" (on by default) limits results to legal cards, including older printings of
  Trainer and Energy cards that have a Standard reprint.
- **Deck**: add/remove with steppers, grouped Pokémon / Trainer / Energy, live validation,
  multiple saved decks (new, rename, duplicate, clear, delete).
- **Import / export**: PTCG Live-style text lists. Lines that can't be matched are listed.

## Deck rules checked

| Rule | Notes |
| --- | --- |
| Exactly 60 cards | |
| Max 4 copies per name | Counted across printings; basic Energy exempt |
| At least 1 Basic Pokémon | |
| Every card Standard legal | See below |
| Max 1 ACE SPEC | By `rarity === 'ACE SPEC Rare'`, or by name for other printings |

## How legality works

Legality is decided locally, not by the API's `legal.standard` flag (it is wrong for new sets).
`isStandardLegal` in `src/lib/legality.ts` checks, in order:

1. `CARD_OVERRIDES[card.id]`
2. Basic Energy → legal
3. Card's set is in `STANDARD_SETS` **and** its regulation mark is not a rotated one
4. Trainer/Energy whose name has a legal printing in a Standard set (reprint rule; never Pokémon)
5. Otherwise not legal

Step 3's mark check exists because Standard sets contain a few reprints that still carry an old
mark (for example `sv08-252` Jet Energy, mark G). Cards with no mark in the API fall back to the
set rule.

## Updating `src/data/standardSets.ts`

Do this when a set releases and at each rotation.

1. **New set**: add an entry at the end of `STANDARD_SETS` (id, name, `abbr`, `mark`,
   `verified: false`). If TCGdex has no regulation marks for it yet, set `mark: null` and add a
   `note`; cards from that set get an "unverified" badge.
2. **Rotation**: remove the rotated sets from `STANDARD_SETS`, add them to `EXCLUDED_SETS` with a
   reason, and remove the rotated letter from `STANDARD_MARKS`.
3. **Single cards** (promos, bans, special reprint sets): add `'<card id>': true | false` to
   `CARD_OVERRIDES`. Overridden cards validate correctly, but a card overridden to legal from a
   non-Standard set only shows in the browser with "Standard only" off.
4. Run `npm run verify:sets`. It prints each set's name, abbreviation, release date, mark counts
   and a sampled Pokémon's `regulationMark | legal.standard`, and lists `sv`/`me` sets that are in
   neither list. Fix anything marked `CHECK` and set `verified: true` where it says so. It exits
   non-zero while something needs attention. Add new series ids to `SERIES` in
   `scripts/verifySets.ts` when a new series starts.
5. Run `npm test`.

The app caches derived legality data (reprint names, ACE SPEC names) in `localStorage` for a day;
editing `STANDARD_SETS` or `STANDARD_MARKS` invalidates that cache automatically.

## Open items

- **Delta Reign (`me06`)** is listed as legal but TCGdex has no marks or images for it yet and
  reports `legal.standard=false`. Confirm against pokemon.com, then drop the `note`.
- **30th Celebration (`30th`, `30th-c`) and Black Star promos (`svp`, `mep`)** are excluded
  wholesale. Their legality is per card; add `CARD_OVERRIDES` entries as needed.
- **Export format** follows lists as PTCG Live writes them (`4 Pikachu ex SSP 57`, unpadded
  numbers, `Basic {G} Energy`), but has not been checked by pasting into PTCG Live itself.
- Importing a line whose set abbreviation isn't a Standard set falls back to the card name and
  picks the newest Standard printing.

## Layout

```
src/data/standardSets.ts   manual Standard list, marks, exclusions, overrides
src/lib/                   pure TS, no React: cards (SDK wrapper + retry), legality, validation,
                           decklist (parse/serialize), importResolve, standardData (cached)
src/store/                 Zustand stores (decks persisted)
src/features/              browser, deck, import-export
scripts/verifySets.ts      npm run verify:sets
```
