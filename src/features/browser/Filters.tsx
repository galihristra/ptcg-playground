import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { STANDARD_SETS } from '../../data/standardSets'
import { listRarities, listSets } from '../../lib/cards'
import type { CardFilters, Category } from '../../lib/types'

const TYPES = ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water']
const STAGES = ['Basic', 'Stage1', 'Stage2', 'MEGA', 'VMAX', 'VSTAR', 'BREAK', 'LEVEL-UP', 'RESTORED', 'Baby', 'V-UNION']
const STAGE_LABEL: Record<string, string> = { Stage1: 'Stage 1', Stage2: 'Stage 2' }

const field =
  'h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400'

interface Props {
  filters: CardFilters
  onChange: (filters: CardFilters) => void
  standardOnly: boolean
  onStandardOnlyChange: (value: boolean) => void
}

export function Filters({ filters, onChange, standardOnly, onStandardOnlyChange }: Props) {
  // The name box is debounced so typing doesn't fire a request per keystroke.
  const [name, setName] = useState(filters.name ?? '')
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.name ?? '') !== name) onChange({ ...filters, name: name || undefined })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
  useEffect(() => {
    setName(filters.name ?? '')
  }, [filters.name])

  const allSets = useQuery({ queryKey: ['sets'], queryFn: listSets, enabled: !standardOnly })
  const rarities = useQuery({ queryKey: ['rarities'], queryFn: listRarities })
  const sets = standardOnly ? [...STANDARD_SETS].reverse() : [...(allSets.data ?? [])].reverse()

  const set = <K extends keyof CardFilters>(key: K, value: CardFilters[K] | '') =>
    onChange({ ...filters, [key]: value === '' ? undefined : value })
  const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v))
  const active = Object.values(filters).some((v) => v != null && v !== '')

  return (
    <form
      role="search"
      aria-label="Card filters"
      className="flex flex-wrap items-end gap-2 border-b border-slate-800 bg-slate-950/60 p-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-slate-400">
        Name
        <input
          type="search"
          className={field}
          placeholder="Search cards…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Category
        <select className={field} value={filters.category ?? ''} onChange={(e) => set('category', e.target.value as Category | '')}>
          <option value="">All</option>
          <option value="Pokemon">Pokémon</option>
          <option value="Trainer">Trainer</option>
          <option value="Energy">Energy</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Type
        <select className={field} value={filters.type ?? ''} onChange={(e) => set('type', e.target.value)}>
          <option value="">Any</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Stage
        <select className={field} value={filters.stage ?? ''} onChange={(e) => set('stage', e.target.value)}>
          <option value="">Any</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1 text-xs text-slate-400">
        <legend className="mb-1">HP</legend>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            aria-label="Minimum HP"
            placeholder="min"
            className={`${field} w-18`}
            value={filters.hpMin ?? ''}
            onChange={(e) => set('hpMin', num(e.target.value) ?? '')}
          />
          <span aria-hidden>–</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={10}
            aria-label="Maximum HP"
            placeholder="max"
            className={`${field} w-18`}
            value={filters.hpMax ?? ''}
            onChange={(e) => set('hpMax', num(e.target.value) ?? '')}
          />
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Set
        <select className={`${field} max-w-44`} value={filters.setId ?? ''} onChange={(e) => set('setId', e.target.value)}>
          <option value="">{standardOnly ? 'All Standard sets' : 'All sets'}</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        Rarity
        <select className={`${field} max-w-40`} value={filters.rarity ?? ''} onChange={(e) => set('rarity', e.target.value)}>
          <option value="">Any</option>
          {(rarities.data ?? []).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm">
        <input
          type="checkbox"
          className="accent-amber-400"
          checked={standardOnly}
          onChange={(e) => onStandardOnlyChange(e.target.checked)}
        />
        Standard only
      </label>
      <button
        type="button"
        className="h-9 rounded-md px-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        disabled={!active}
        onClick={() => onChange({})}
      >
        Reset
      </button>
    </form>
  )
}
