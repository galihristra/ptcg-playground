// The playtest engine: (state, action) => state. Pure and deterministic; it never throws.
// Invalid actions return the same state reference (see reducer/zones.ts for the logging rule).

import { addDamage, attach, evolve, knockOut, playToBench, playTrainer, promote, retreat, setCondition, toggleBurn, togglePoison } from './reducer/board'
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
    case 'PLAY_TO_BENCH':
      return playToBench(state, action)
    case 'EVOLVE':
      return evolve(state, action)
    case 'ATTACH':
      return attach(state, action)
    case 'PLAY_TRAINER':
      return playTrainer(state, action)
    case 'RETREAT':
      return retreat(state, action)
    case 'PROMOTE':
      return promote(state, action)
    case 'KNOCK_OUT':
      return knockOut(state, action)
    case 'ADD_DAMAGE':
      return addDamage(state, action)
    case 'SET_CONDITION':
      return setCondition(state, action)
    case 'TOGGLE_POISON':
      return togglePoison(state, action)
    case 'TOGGLE_BURN':
      return toggleBurn(state, action)
    default:
      action satisfies never
      return state
  }
}
