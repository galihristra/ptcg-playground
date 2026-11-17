// Soft rules. computeWarnings is derived from the state on demand and never blocks an action,
// because card effects legitimately bend most of these rules (a Stadium can raise the Bench size,
// an Ability can attach extra Energy, and so on). Scope is the current Standard format.
//
// Warnings about what happened "this turn" disappear when the turn ends, like the counters they
// are built on.

import { normalizeName } from '../legality'
import { allPokemonInPlay, hasBasicInHand, topCard } from './selectors'
import { PRIZE_COUNT } from './setup'
import type { GameState, PokemonInPlay, Warning } from './types'

export const BENCH_SIZE = 5

const names = (slot: PokemonInPlay) => topCard(slot).card.name

function turnWarnings(state: GameState): Warning[] {
  const { turnCounts: t } = state
  const out: Warning[] = []
  if (t.supportersPlayed > 1) out.push({ code: 'multiple-supporters', message: `${t.supportersPlayed} Supporters played this turn. The limit is 1.` })
  if (t.supportersPlayed > 0 && state.phase === 'playing' && state.turn === 1 && state.goingFirst === true) {
    out.push({ code: 'supporter-first-turn', message: "A Supporter was played on the first turn. The player going first can't play one." })
  }
  if (t.energyAttached > 1) out.push({ code: 'multiple-energy-attachments', message: `${t.energyAttached} Energy cards attached from the hand this turn. The limit is 1.` })
  if (t.retreats > 1) out.push({ code: 'multiple-retreats', message: `Retreated ${t.retreats} times this turn. The limit is 1.` })
  if (t.stadiumsPlayed > 1) out.push({ code: 'multiple-stadiums', message: `${t.stadiumsPlayed} Stadiums played this turn. The limit is 1.` })
  if (t.sameNameStadiums > 0) {
    const stadium = state.player.stadium
    out.push({
      code: 'duplicate-stadium-name',
      message: 'A Stadium was played while a Stadium with the same name was in play.',
      ...(stadium ? { relatedUids: [stadium.uid] } : {}),
    })
  }
  return out
}

function evolveWarnings(state: GameState, slot: PokemonInPlay): Warning[] {
  const out: Warning[] = []

  // Each card in the stack should evolve from the one beneath it. Unknown evolveFrom is skipped:
  // older saved decks and some new TCGdex cards do not have it.
  for (let i = 1; i < slot.stack.length; i++) {
    const upper = slot.stack[i]
    const lower = slot.stack[i - 1]
    const from = upper.card.evolveFrom
    if (from !== undefined && normalizeName(from) !== normalizeName(lower.card.name)) {
      out.push({
        code: 'evolve-mismatch',
        message: `${upper.card.name} evolves from ${from}, not ${lower.card.name}.`,
        relatedUids: [lower.uid, upper.uid],
      })
    }
  }

  if (slot.evolvedOnTurn !== null && slot.evolvedOnTurn === state.turn) {
    const reasons: string[] = []
    if (state.turn <= 1) reasons.push("Pokémon can't evolve on the first turn")
    else if (slot.enteredPlayOnTurn === state.turn) reasons.push('it came into play this turn')
    if (slot.evolutionsOnTurn > 1) reasons.push(`it evolved ${slot.evolutionsOnTurn} times this turn`)
    if (reasons.length > 0) {
      out.push({ code: 'evolve-same-turn', message: `${names(slot)} was evolved too early: ${reasons.join(' and ')}.`, relatedUids: slot.stack.map((c) => c.uid) })
    }
  }
  return out
}

function boardWarnings(state: GameState): Warning[] {
  const out: Warning[] = []
  const { bench } = state.player
  if (bench.length > BENCH_SIZE) {
    out.push({ code: 'bench-over-5', message: `${bench.length} Pokémon on the Bench. The limit is ${BENCH_SIZE} unless a card says otherwise.`, relatedUids: bench.slice(BENCH_SIZE).map((s) => topCard(s).uid) })
  }
  for (const slot of allPokemonInPlay(state)) {
    const strangers = slot.stack.filter((c) => c.card.category !== 'Pokemon')
    if (strangers.length > 0) {
      out.push({ code: 'non-pokemon-in-play', message: `${strangers.map((c) => c.card.name).join(', ')} is in play as a Pokémon but is not a Pokémon card.`, relatedUids: strangers.map((c) => c.uid) })
    }
    out.push(...evolveWarnings(state, slot))
  }
  return out
}

function prizeWarnings(state: GameState): Warning[] {
  const count = state.player.prizes.length
  const relatedUids = state.player.prizes.map((c) => c.uid)
  if (count > PRIZE_COUNT) return [{ code: 'prize-count', message: `${count} Prize cards. There should never be more than ${PRIZE_COUNT}.`, relatedUids }]
  const expected = PRIZE_COUNT - state.prizesTaken
  if (state.phase === 'playing' && count < expected) {
    return [{ code: 'prize-count', message: `${count} Prize cards left, but ${expected} expected after taking ${state.prizesTaken}.`, relatedUids }]
  }
  return []
}

export function computeWarnings(state: GameState): Warning[] {
  const out: Warning[] = []
  if (state.phase === 'setup' && state.player.hand.length > 0 && allPokemonInPlay(state).length === 0 && !hasBasicInHand(state)) {
    out.push({ code: 'no-basic-in-setup-hand', message: 'No Basic Pokémon in the opening hand. Take a mulligan.' })
  }
  out.push(...turnWarnings(state), ...boardWarnings(state), ...prizeWarnings(state))
  return out
}
