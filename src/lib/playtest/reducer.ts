// The playtest engine: (state, action) => state. Pure and deterministic; it never throws.
// Invalid actions return the same state reference (see reducer/zones.ts for the logging rule).

import { coinFlip, draw, endTurn, move, mulligan, placeOpening, putOnBottom, reset, shuffleDeck, startGame, takePrize } from './reducer/zones'
import type { Action, GameState } from './types'

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'MULLIGAN':
      return mulligan(state)
    case 'PLACE_OPENING':
      return placeOpening(state, action)
    case 'START_GAME':
      return startGame(state, action)
    case 'DRAW':
      return draw(state, action)
    case 'MOVE':
      return move(state, action)
    case 'SHUFFLE_DECK':
      return shuffleDeck(state)
    case 'PUT_ON_BOTTOM':
      return putOnBottom(state, action)
    case 'TAKE_PRIZE':
      return takePrize(state, action)
    case 'FLIP_COIN':
      return coinFlip(state)
    case 'END_TURN':
      return endTurn(state)
    case 'RESET':
      return reset(state, action)
    // Board actions arrive with the board model (milestone M3). Until then they are no-ops.
    case 'PLAY_TO_BENCH':
    case 'EVOLVE':
    case 'ATTACH':
    case 'PLAY_TRAINER':
    case 'RETREAT':
    case 'PROMOTE':
    case 'KNOCK_OUT':
    case 'ADD_DAMAGE':
    case 'SET_CONDITION':
    case 'TOGGLE_POISON':
    case 'TOGGLE_BURN':
      return state
    default:
      action satisfies never
      return state
  }
}
