// Handlers for the board: Pokémon in play, attachments, Trainers, and damage / condition markers.
// Same convention as zones.ts: an invalid action returns the same state reference.
// Nothing here enforces the rules of the game (that is what warnings are for); it only keeps the
// board consistent.

import { findInPlay, locate, topCard } from '../selectors'
import type { Action, GameState, PokemonInPlay, SpecialCondition } from '../types'
import { appendLog, placeCard, plural, takeCard, updateSlot, withPlayer } from './helpers'

type Of<T extends Action['type']> = Extract<Action, { type: T }>

const nameOf = (slot: PokemonInPlay) => topCard(slot).card.name
const withNotes = (text: string, notes: string[]) => (notes.length > 0 ? `${text} (${notes.join('; ')}).` : `${text}.`)
const clearConditions = (slot: PokemonInPlay): PokemonInPlay => ({ ...slot, condition: null, poisoned: false, burned: false })

/** Hand -> a new Benched Pokémon. */
export function playToBench(state: GameState, action: Of<'PLAY_TO_BENCH'>): GameState {
  if (locate(state, action.uid)?.zone !== 'hand') return state
  const taken = takeCard(state, action.uid)
  if (!taken) return state
  return appendLog(placeCard(taken.state, taken.card, 'bench').state, `Played ${taken.card.card.name} to the Bench.`)
}

/**
 * Puts a card on top of a Pokémon in play. The card may come from any zone (card effects evolve
 * from the deck or discard pile). Attachments and damage stay; Special Conditions are removed.
 * `evolveFrom` is not checked here: a mismatch is a warning, not an error.
 */
export function evolve(state: GameState, action: Of<'EVOLVE'>): GameState {
  const target = findInPlay(state, action.target)
  const from = locate(state, action.uid)
  if (!target || !from || from.slotId === target.id) return state
  const taken = takeCard(state, action.uid)
  if (!taken) return state
  const next = updateSlot(taken.state, target.id, (slot) => ({ ...clearConditions(slot), stack: [...slot.stack, taken.card], evolvedOnTurn: state.turn }))
  return appendLog(next, withNotes(`Evolved ${nameOf(target)} into ${taken.card.card.name}`, taken.notes))
}

/** Attaches a card (Energy or Tool) from any zone to a Pokémon in play. Only an Energy from the hand counts as the turn's attachment. */
export function attach(state: GameState, action: Of<'ATTACH'>): GameState {
  const target = findInPlay(state, action.target)
  const from = locate(state, action.uid)
  if (!target || !from || from.slotId === target.id) return state
  const taken = takeCard(state, action.uid)
  if (!taken) return state
  let next = updateSlot(taken.state, target.id, (slot) => ({ ...slot, attached: [...slot.attached, taken.card] }))
  if (from.zone === 'hand' && taken.card.card.category === 'Energy') {
    next = { ...next, turnCounts: { ...next.turnCounts, energyAttached: next.turnCounts.energyAttached + 1 } }
  }
  return appendLog(next, withNotes(`Attached ${taken.card.card.name} to ${nameOf(target)}`, taken.notes))
}

/**
 * Plays a Trainer card from the hand. Supporters and Items go to the discard pile, a Stadium goes
 * to the Stadium spot (replacing the one in play). A Tool needs a target, so it is left in the
 * hand with a log line. A Trainer with an unknown type is discarded without counting anything.
 */
export function playTrainer(state: GameState, action: Of<'PLAY_TRAINER'>): GameState {
  const from = locate(state, action.uid)
  if (!from || from.zone !== 'hand' || from.card.card.category !== 'Trainer') return state
  const { name, trainerType } = from.card.card
  if (trainerType === 'Tool') return appendLog(state, `${name} is a Pokémon Tool: attach it to a Pokémon instead.`)

  const taken = takeCard(state, action.uid)
  if (!taken) return state
  const counts = taken.state.turnCounts
  if (trainerType === 'Stadium') {
    const placed = placeCard(taken.state, taken.card, 'stadium')
    const next = { ...placed.state, turnCounts: { ...counts, stadiumsPlayed: counts.stadiumsPlayed + 1 } }
    return appendLog(next, withNotes(`Played the Stadium ${name}`, placed.notes))
  }
  const discarded = placeCard(taken.state, taken.card, 'discard').state
  if (trainerType === 'Supporter') {
    return appendLog({ ...discarded, turnCounts: { ...counts, supportersPlayed: counts.supportersPlayed + 1 } }, `Played the Supporter ${name}.`)
  }
  return appendLog(discarded, `Played ${name}.`)
}

/**
 * Swaps the Active Pokémon with a Benched one, which takes over the same Bench position. The
 * retreating Pokémon loses its Special Conditions. Energy is not discarded: the player pays the
 * Retreat Cost by moving cards.
 */
export function retreat(state: GameState, action: Of<'RETREAT'>): GameState {
  const { active, bench } = state.player
  const target = findInPlay(state, action.benchTarget)
  if (!active || !target || target.id === active.id) return state
  const next = withPlayer(state, { active: target, bench: bench.map((slot) => (slot.id === target.id ? clearConditions(active) : slot)) })
  return appendLog(
    { ...next, turnCounts: { ...next.turnCounts, retreats: next.turnCounts.retreats + 1 } },
    `Retreated ${nameOf(active)} and sent out ${nameOf(target)}.`,
  )
}

/** Moves a Benched Pokémon into an empty Active Spot, e.g. after a Knock Out. */
export function promote(state: GameState, action: Of<'PROMOTE'>): GameState {
  const { active, bench } = state.player
  const target = findInPlay(state, action.benchTarget)
  if (active || !target) return state
  const next = withPlayer(state, { active: target, bench: bench.filter((slot) => slot.id !== target.id) })
  return appendLog(next, `Promoted ${nameOf(target)} to the Active Spot.`)
}

/** Sends the whole Pokémon (every card in the stack, then every attachment) to the discard pile. Prizes and promotion stay with the player. */
export function knockOut(state: GameState, action: Of<'KNOCK_OUT'>): GameState {
  const target = findInPlay(state, action.target)
  if (!target) return state
  const cards = [...target.stack, ...target.attached]
  const removed = updateSlot(state, target.id, () => null)
  const next = withPlayer(removed, { discard: [...removed.player.discard, ...cards] })
  return appendLog(next, `${nameOf(target)} was Knocked Out (${plural(cards.length, 'card')} discarded).`)
}

/** Adds damage in multiples of 10; a negative amount heals. Damage never goes below 0. */
export function addDamage(state: GameState, action: Of<'ADD_DAMAGE'>): GameState {
  const target = findInPlay(state, action.target)
  if (!target || !Number.isInteger(action.amount) || action.amount === 0 || action.amount % 10 !== 0) return state
  const damage = Math.max(0, target.damage + action.amount)
  if (damage === target.damage) return state
  const next = updateSlot(state, target.id, (slot) => ({ ...slot, damage }))
  const change = damage - target.damage
  return appendLog(next, change > 0 ? `${nameOf(target)} took ${change} damage (${damage} total).` : `Healed ${-change} damage from ${nameOf(target)} (${damage} left).`)
}

export function setCondition(state: GameState, action: Of<'SET_CONDITION'>): GameState {
  const target = findInPlay(state, action.target)
  if (!target || target.condition === action.condition) return state
  const next = updateSlot(state, target.id, (slot) => ({ ...slot, condition: action.condition }))
  const label = (c: SpecialCondition) => `${c[0].toUpperCase()}${c.slice(1)}`
  if (action.condition !== null) return appendLog(next, `${nameOf(target)} is now ${label(action.condition)}.`)
  return appendLog(next, `${nameOf(target)} is no longer ${target.condition ? label(target.condition) : 'affected'}.`)
}

function toggleMarker(state: GameState, ref: string, key: 'poisoned' | 'burned'): GameState {
  const target = findInPlay(state, ref)
  if (!target) return state
  const next = updateSlot(state, target.id, (slot) => ({ ...slot, [key]: !slot[key] }))
  const label = key === 'poisoned' ? 'Poisoned' : 'Burned'
  return appendLog(next, target[key] ? `${nameOf(target)} is no longer ${label}.` : `${nameOf(target)} is now ${label}.`)
}

export const togglePoison = (state: GameState, action: Of<'TOGGLE_POISON'>) => toggleMarker(state, action.target, 'poisoned')
export const toggleBurn = (state: GameState, action: Of<'TOGGLE_BURN'>) => toggleMarker(state, action.target, 'burned')
