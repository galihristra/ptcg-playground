// Playtest engine state model. Everything here is plain serializable data (no Maps, Sets, classes
// or functions) so a game can be snapshotted for undo, dumped to JSON and compared in tests.
// Scope is the current Standard format only: no VSTAR/GX markers or other legacy mechanics.

import type { Card } from '../types'
import type { DeckEntry } from '../validation'

export type Zone = 'deck' | 'hand' | 'prizes' | 'discard' | 'lostZone' | 'stadium' | 'active' | 'bench'

/** One physical copy of a card. */
export type CardInstance = {
  /** Unique per copy: `${card.id}#${n}`, n from 1. */
  uid: string
  card: Card
}

export type SpecialCondition = 'asleep' | 'confused' | 'paralyzed'

export type PokemonInPlay = {
  /** Stable slot id ('p1', 'p2', ...). It survives evolving and devolving, so use it for React keys. */
  id: string
  /** Bottom to top, e.g. [Basic, Stage 1, Stage 2]. The last element is the visible card. */
  stack: CardInstance[]
  /** Energy and Tools. */
  attached: CardInstance[]
  /** Total damage on the Pokémon, in multiples of 10. */
  damage: number
  poisoned: boolean
  burned: boolean
  /** Asleep, Confused and Paralyzed are mutually exclusive. */
  condition: SpecialCondition | null
  enteredPlayOnTurn: number
  /** Turn of the most recent evolution, or null if it has not evolved since entering play. */
  evolvedOnTurn: number | null
  /** How many times it evolved during `evolvedOnTurn` (0 if it never evolved). */
  evolutionsOnTurn: number
}

export type PlayerState = {
  /** Index 0 is the top of the deck. */
  deck: CardInstance[]
  hand: CardInstance[]
  prizes: CardInstance[]
  discard: CardInstance[]
  lostZone: CardInstance[]
  stadium: CardInstance | null
  active: PokemonInPlay | null
  bench: PokemonInPlay[]
}

/** Per-turn counters, reset by END_TURN. Counters (not booleans) so a second play in a turn is visible to warnings. */
export type TurnCounts = {
  energyAttached: number
  supportersPlayed: number
  retreats: number
  stadiumsPlayed: number
  /** Stadiums played onto a Stadium with the same name, which the rules do not allow. */
  sameNameStadiums: number
}

export type LogEntry = {
  /** 1-based sequence number. */
  n: number
  text: string
}

export type GameState = {
  phase: 'setup' | 'playing'
  /** Zones live under `player` so a two-player mode can later become `players: [...]`. */
  player: PlayerState
  /** 0 during setup, 1+ once playing. */
  turn: number
  goingFirst: boolean | null
  turnCounts: TurnCounts
  mulligans: number
  /** Prize cards that have left the prize zone. Expected prizes remaining = 6 - prizesTaken. */
  prizesTaken: number
  /** Number for the next PokemonInPlay slot id. */
  nextSlot: number
  /** PRNG state (unsigned 32-bit). Every shuffle and coin flip consumes and updates it. */
  rng: number
  /** Every uid in the game, for the conservation invariant. */
  initialUids: string[]
  /** The deck this game was built from, so RESET stays pure. */
  deckEntries: DeckEntry[]
  log: LogEntry[]
}

/**
 * Card references are by uid; the reducer finds the card itself. `target` and `benchTarget` accept
 * either a slot id or the uid of any card in that Pokémon's stack or attachments.
 */
export type Action =
  // setup
  | { type: 'MULLIGAN' }
  | { type: 'PLACE_OPENING'; active: string; bench: string[] }
  | { type: 'START_GAME'; goingFirst: boolean }
  // generic movement
  | { type: 'DRAW'; count: number }
  | { type: 'MOVE'; uid: string; to: Zone; position?: 'top' | 'bottom' }
  | { type: 'SHUFFLE_DECK' }
  | { type: 'PUT_ON_BOTTOM'; uids: string[] }
  | { type: 'TAKE_PRIZE'; uid: string }
  // playing cards
  | { type: 'PLAY_TO_BENCH'; uid: string }
  | { type: 'EVOLVE'; uid: string; target: string }
  | { type: 'ATTACH'; uid: string; target: string }
  | { type: 'PLAY_TRAINER'; uid: string }
  | { type: 'RETREAT'; benchTarget: string }
  | { type: 'PROMOTE'; benchTarget: string }
  | { type: 'KNOCK_OUT'; target: string }
  // markers
  | { type: 'ADD_DAMAGE'; target: string; amount: number }
  | { type: 'SET_CONDITION'; target: string; condition: SpecialCondition | null }
  | { type: 'TOGGLE_POISON'; target: string }
  | { type: 'TOGGLE_BURN'; target: string }
  // turn / misc
  | { type: 'FLIP_COIN' }
  | { type: 'END_TURN' }
  | { type: 'RESET'; seed?: number }

export type ActionType = Action['type']

export type WarningCode =
  | 'bench-over-5'
  | 'no-basic-in-setup-hand'
  | 'multiple-supporters'
  | 'multiple-energy-attachments'
  | 'multiple-retreats'
  | 'multiple-stadiums'
  | 'supporter-first-turn'
  | 'evolve-mismatch'
  | 'evolve-same-turn'
  | 'prize-count'
  | 'duplicate-stadium-name'
  | 'non-pokemon-in-play'

/** A soft rule violation. Warnings are derived from state and never block an action. */
export type Warning = {
  code: WarningCode
  message: string
  relatedUids?: string[]
}
