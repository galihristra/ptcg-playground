// What the player can do with the selected card, as plain data. Pure, so it can be tested without React.

import { allPokemonInPlay, locate, topCard, findInPlay } from '../../lib/playtest/selectors'
import type { Action, GameState, SpecialCondition } from '../../lib/playtest/types'
import { isBasicPokemon } from '../../lib/types'

export type CardAction = {
  label: string
  tone?: 'primary' | 'danger'
} & (
  | { run: Action }
  /** Needs a Pokémon in play as the target: the screen asks the player to pick one. */
  | { pick: 'EVOLVE' | 'ATTACH' }
)

const CONDITIONS: { value: SpecialCondition; label: string }[] = [
  { value: 'asleep', label: 'Asleep' },
  { value: 'confused', label: 'Confused' },
  { value: 'paralyzed', label: 'Paralyzed' },
]

export function actionsFor(game: GameState, uid: string): CardAction[] {
  const loc = locate(game, uid)
  if (!loc) return []
  const { card } = loc.card
  const out: CardAction[] = []
  const move = (label: string, to: 'hand' | 'discard' | 'deck', position?: 'top' | 'bottom', tone?: CardAction['tone']) =>
    out.push({ label, tone, run: { type: 'MOVE', uid, to, ...(position ? { position } : {}) } })

  // A Pokémon in play: markers, switching and Knock Out act on the whole Pokémon.
  if (loc.where === 'stack') {
    const slot = findInPlay(game, uid)
    if (!slot || topCard(slot).uid !== uid) return []
    if (loc.zone === 'bench') {
      out.push(game.player.active ? { label: 'Switch with Active', tone: 'primary', run: { type: 'RETREAT', benchTarget: slot.id } } : { label: 'Promote to Active', tone: 'primary', run: { type: 'PROMOTE', benchTarget: slot.id } })
    }
    for (const amount of [10, 50, 100]) out.push({ label: `+${amount}`, run: { type: 'ADD_DAMAGE', target: slot.id, amount } })
    if (slot.damage > 0) out.push({ label: '−10', run: { type: 'ADD_DAMAGE', target: slot.id, amount: -10 } })
    for (const c of CONDITIONS) {
      const on = slot.condition === c.value
      out.push({ label: on ? `Clear ${c.label}` : c.label, run: { type: 'SET_CONDITION', target: slot.id, condition: on ? null : c.value } })
    }
    out.push({ label: slot.poisoned ? 'Clear Poison' : 'Poison', run: { type: 'TOGGLE_POISON', target: slot.id } })
    out.push({ label: slot.burned ? 'Clear Burn' : 'Burn', run: { type: 'TOGGLE_BURN', target: slot.id } })
    move(slot.stack.length > 1 ? 'Devolve (top card to hand)' : 'Return to hand', 'hand')
    out.push({ label: 'Knock Out', tone: 'danger', run: { type: 'KNOCK_OUT', target: slot.id } })
    return out
  }

  if (loc.where === 'attached') {
    move('Discard', 'discard', undefined, 'primary')
    out.push({ label: 'Move to another Pokémon…', pick: 'ATTACH' })
    move('To hand', 'hand')
    return out
  }

  if (loc.zone === 'prizes') return [{ label: 'Take this Prize', tone: 'primary', run: { type: 'TAKE_PRIZE', uid } }]

  // A loose card in the hand, deck, discard pile, Lost Zone or Stadium spot.
  const inHand = loc.zone === 'hand'
  const anyInPlay = game.player.active !== null || game.player.bench.length > 0
  if (card.category === 'Pokemon') {
    if (isBasicPokemon(card) || !inHand) {
      if (!game.player.active) out.push({ label: 'To Active Spot', tone: 'primary', run: { type: 'MOVE', uid, to: 'active' } })
      out.push({ label: 'To Bench', tone: game.player.active ? 'primary' : undefined, run: inHand ? { type: 'PLAY_TO_BENCH', uid } : { type: 'MOVE', uid, to: 'bench' } })
    }
    if (!isBasicPokemon(card) && anyInPlay) out.push({ label: 'Evolve a Pokémon…', tone: 'primary', pick: 'EVOLVE' })
  } else if (card.category === 'Energy' || card.trainerType === 'Tool') {
    if (anyInPlay) out.push({ label: 'Attach to…', tone: 'primary', pick: 'ATTACH' })
  } else if (inHand) {
    out.push({ label: card.trainerType === 'Stadium' ? 'Play Stadium' : 'Play', tone: 'primary', run: { type: 'PLAY_TRAINER', uid } })
  }
  if (!inHand) move('To hand', 'hand', undefined, out.length === 0 ? 'primary' : undefined)
  if (loc.zone !== 'discard') move('Discard', 'discard')
  move('Top of deck', 'deck', 'top')
  move('Bottom of deck', 'deck', 'bottom')
  return out
}

/**
 * What double-clicking a card in the hand does: its main action. Evolving or attaching goes straight
 * to the Pokémon when only one fits (the one it evolves from, or the only Pokémon in play); otherwise
 * the screen asks for a target. Null when the card is not in the hand or cannot be played right now.
 */
export function defaultAction(game: GameState, uid: string): CardAction | null {
  const loc = locate(game, uid)
  if (!loc || loc.where !== 'zone' || loc.zone !== 'hand') return null
  const action = actionsFor(game, uid).find((a) => a.tone === 'primary')
  if (!action) return null
  if ('run' in action) return action
  const inPlay = allPokemonInPlay(game)
  const { evolveFrom } = loc.card.card
  const targets = action.pick === 'EVOLVE' && evolveFrom ? inPlay.filter((slot) => topCard(slot).card.name === evolveFrom) : inPlay
  if (targets.length !== 1) return action
  return { label: action.label, tone: action.tone, run: { type: action.pick, uid, target: targets[0].id } }
}
