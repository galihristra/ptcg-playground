// Handlers for setup, generic card movement, and turn bookkeeping.
// Convention: an invalid action returns the same state reference. Where the player would want to
// know why nothing happened, the handler returns a new state that differs only by a log line.

import { flipCoin, mulberry32, shuffle } from '../rng'
import { findInPlay, locate } from '../selectors'
import { OPENING_HAND_SIZE, PRIZE_COUNT, createGame, emptyTurnCounts } from '../setup'
import type { Action, GameState } from '../types'
import { ZONE_LABEL, appendLog, drawCards, placeCard, plural, takeCard, withPlayer } from './helpers'

type Of<T extends Action['type']> = Extract<Action, { type: T }>

const withNotes = (text: string, notes: string[]) => (notes.length > 0 ? `${text} (${notes.join('; ')}).` : `${text}.`)

export function mulligan(state: GameState): GameState {
  if (state.phase !== 'setup') return state
  const { hand, deck } = state.player
  const shuffled = shuffle([...deck, ...hand], state.rng)
  const reset = { ...withPlayer(state, { deck: shuffled.cards, hand: [] }), rng: shuffled.seed, mulligans: state.mulligans + 1 }
  const { state: next, drawn } = drawCards(reset, OPENING_HAND_SIZE)
  return appendLog(next, `Mulligan ${next.mulligans}: shuffled the hand into the deck and drew ${drawn}.`)
}

export function placeOpening(state: GameState, action: Of<'PLACE_OPENING'>): GameState {
  if (state.phase !== 'setup') return state
  const uids = [action.active, ...action.bench]
  const inHand = new Set(state.player.hand.map((c) => c.uid))
  if (new Set(uids).size !== uids.length || uids.some((uid) => !inHand.has(uid))) return state
  if (state.player.active) return appendLog(state, 'The Active Spot is already occupied, so nothing was placed.')

  let next = state
  uids.forEach((uid, i) => {
    const taken = takeCard(next, uid)
    if (taken) next = placeCard(taken.state, taken.card, i === 0 ? 'active' : 'bench').state
  })
  const active = next.player.active?.stack[0].card.name
  const bench = next.player.bench.slice(-action.bench.length).map((s) => s.stack[0].card.name)
  return appendLog(next, action.bench.length > 0 ? `Placed ${active} as the Active Pokémon and ${bench.join(', ')} on the Bench.` : `Placed ${active} as the Active Pokémon.`)
}

export function startGame(state: GameState, action: Of<'START_GAME'>): GameState {
  if (state.phase !== 'setup') return state
  const { deck, prizes } = state.player
  const count = Math.min(PRIZE_COUNT, deck.length)
  const next: GameState = {
    ...withPlayer(state, { deck: deck.slice(count), prizes: [...prizes, ...deck.slice(0, count)] }),
    phase: 'playing',
    turn: 1,
    goingFirst: action.goingFirst,
    turnCounts: emptyTurnCounts(),
  }
  const order = action.goingFirst ? 'first' : 'second'
  return appendLog(
    next,
    count < PRIZE_COUNT
      ? `Game started, going ${order}. Only ${plural(count, 'card')} left in the deck, so set ${plural(count, 'Prize card')}. Turn 1.`
      : `Game started, going ${order}. Set ${PRIZE_COUNT} Prize cards. Turn 1.`,
  )
}

export function draw(state: GameState, action: Of<'DRAW'>): GameState {
  if (!Number.isInteger(action.count) || action.count < 1) return state
  const { state: next, drawn } = drawCards(state, action.count)
  if (drawn === 0) return appendLog(state, "Can't draw: the deck is empty.")
  return appendLog(next, drawn < action.count ? `Drew ${drawn} of ${action.count}: the deck is now empty.` : `Drew ${plural(drawn, 'card')}.`)
}

export function move(state: GameState, action: Of<'MOVE'>): GameState {
  const from = locate(state, action.uid)
  if (!from) return state
  const name = from.card.card.name

  // Already there. The deck is the exception: moving within it re-positions the card.
  const wholePokemon = from.where === 'stack' && findInPlay(state, action.uid)?.stack.length === 1
  if (from.zone === action.to && action.to !== 'deck' && (from.where === 'zone' || wholePokemon)) return state

  if (action.to === 'active' && state.player.active) {
    return appendLog(state, `Can't move ${name} to the Active Spot: it is occupied. Retreat or promote to switch Pokémon.`)
  }

  const taken = takeCard(state, action.uid)
  if (!taken) return state
  const placed = placeCard(taken.state, taken.card, action.to, action.position)
  const where = action.to === 'deck' ? `the ${action.position === 'bottom' ? 'bottom' : 'top'} of the deck` : ZONE_LABEL[action.to]
  return appendLog(placed.state, withNotes(`Moved ${name} from ${ZONE_LABEL[from.zone]} to ${where}`, [...taken.notes, ...placed.notes]))
}

export function shuffleDeck(state: GameState): GameState {
  const shuffled = shuffle(state.player.deck, state.rng)
  return appendLog({ ...withPlayer(state, { deck: shuffled.cards }), rng: shuffled.seed }, 'Shuffled the deck.')
}

/** Puts the given cards on the bottom of the deck in the order given (the last uid ends up at the very bottom). */
export function putOnBottom(state: GameState, action: Of<'PUT_ON_BOTTOM'>): GameState {
  let next = state
  let moved = 0
  const notes: string[] = []
  for (const uid of new Set(action.uids)) {
    const taken = takeCard(next, uid)
    if (!taken) continue
    next = placeCard(taken.state, taken.card, 'deck', 'bottom').state
    notes.push(...taken.notes)
    moved++
  }
  if (moved === 0) return state
  return appendLog(next, withNotes(`Put ${plural(moved, 'card')} on the bottom of the deck`, notes))
}

export function takePrize(state: GameState, action: Of<'TAKE_PRIZE'>): GameState {
  if (locate(state, action.uid)?.zone !== 'prizes') return state
  const taken = takeCard(state, action.uid)
  if (!taken) return state
  const next = placeCard(taken.state, taken.card, 'hand').state
  return appendLog(next, `Took a Prize card: ${taken.card.card.name}. ${plural(next.player.prizes.length, 'Prize card')} left.`)
}

export function coinFlip(state: GameState): GameState {
  const flip = flipCoin(state.rng)
  return appendLog({ ...state, rng: flip.seed }, `Coin flip: ${flip.heads ? 'heads' : 'tails'}.`)
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state
  const turn = state.turn + 1
  return appendLog({ ...state, turn, turnCounts: emptyTurnCounts() }, `Turn ${turn}.`)
}

/** A fresh game from the same deck. Without a seed it takes the next value from the current rng, so it stays pure. */
export function reset(state: GameState, action: Of<'RESET'>): GameState {
  return createGame(state.deckEntries, action.seed === undefined ? mulberry32(state.rng).seed : action.seed >>> 0)
}
