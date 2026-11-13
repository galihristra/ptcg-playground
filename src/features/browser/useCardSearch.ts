import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { STANDARD_SET_IDS, isStandardSet, standardSetOrder } from '../../data/standardSets'
import { searchCards } from '../../lib/cards'
import { setIdOfCard } from '../../lib/importResolve'
import { normalizeName } from '../../lib/legality'
import type { CardBrief, CardFilters } from '../../lib/types'
import { useStandardData } from '../useStandardData'

const PAGE_SIZE = 120
const BASIC_ENERGY_NAMES = new Set(
  ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy'].flatMap((t) => [
    `${t} energy`.toLowerCase(),
    `basic ${t} energy`.toLowerCase(),
  ]),
)

function byNewestSet(a: CardBrief, b: CardBrief): number {
  const order = standardSetOrder(setIdOfCard(b.id)) - standardSetOrder(setIdOfCard(a.id))
  return order !== 0 ? order : a.localId.localeCompare(b.localId, undefined, { numeric: true })
}

export interface CardSearchResult {
  cards: CardBrief[]
  isLoading: boolean
  error: Error | null
  retry: () => void
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
}

export function useCardSearch(filters: CardFilters, standardOnly: boolean): CardSearchResult {
  const standard = useStandardData()

  // Filters that only Pokémon can satisfy: no point asking for Trainer/Energy reprints.
  const pokemonOnly =
    filters.category === 'Pokemon' || !!filters.type || !!filters.stage || filters.hpMin != null || filters.hpMax != null
  const mainEnabled = standardOnly && (!filters.setId || isStandardSet(filters.setId))
  const reprintsEnabled = standardOnly && !pokemonOnly && !filters.setId

  // Standard mode: one query limited to the Standard sets...
  const main = useQuery({
    queryKey: ['cards', 'standard', filters],
    queryFn: () => searchCards(filters, { setIds: STANDARD_SET_IDS }),
    enabled: mainEnabled,
  })
  // ...plus Trainer and Energy printings from every set, kept only if the name is Standard legal.
  const trainers = useQuery({
    queryKey: ['cards', 'any-set', { ...filters, category: 'Trainer' }],
    queryFn: () => searchCards({ ...filters, category: 'Trainer' }),
    enabled: reprintsEnabled && filters.category !== 'Energy',
  })
  const energies = useQuery({
    queryKey: ['cards', 'any-set', { ...filters, category: 'Energy' }],
    queryFn: () => searchCards({ ...filters, category: 'Energy' }),
    enabled: reprintsEnabled && filters.category !== 'Trainer',
  })

  // All-formats mode: server-side pagination (the full card list is ~2.4 MB).
  const paged = useInfiniteQuery({
    queryKey: ['cards', 'paged', filters],
    queryFn: ({ pageParam }) => searchCards(filters, { page: pageParam, perPage: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.length < PAGE_SIZE ? undefined : pages.length + 1),
    enabled: !standardOnly,
  })

  const standardCards = useMemo(() => {
    if (!standardOnly) return []
    const excluded = standard.data?.excludedIds
    const names = standard.data?.reprintNames
    const inSets = (main.data ?? []).filter((c) => !excluded?.has(c.id)).sort(byNewestSet)
    const reprints = [...(trainers.data ?? []), ...(energies.data ?? [])]
      .filter((c) => {
        if (isStandardSet(setIdOfCard(c.id))) return false
        const name = normalizeName(c.name)
        return BASIC_ENERGY_NAMES.has(name) || (names?.has(name) ?? false)
      })
      .sort((a, b) => a.name.localeCompare(b.name) || b.id.localeCompare(a.id))
    return [...inSets, ...reprints]
  }, [standardOnly, standard.data, main.data, trainers.data, energies.data])

  const pagedCards = useMemo(() => paged.data?.pages.flat() ?? [], [paged.data])

  if (!standardOnly) {
    return {
      cards: pagedCards,
      isLoading: paged.isLoading,
      error: paged.error,
      retry: () => void paged.refetch(),
      hasMore: !!paged.hasNextPage,
      loadMore: () => {
        if (paged.hasNextPage && !paged.isFetchingNextPage) void paged.fetchNextPage()
      },
      isLoadingMore: paged.isFetchingNextPage,
    }
  }

  const active = [main, trainers, energies]
  return {
    cards: standardCards,
    isLoading: standard.isLoading || active.some((q) => q.isLoading),
    // Reprint queries failing is not fatal as long as the main result is there.
    error: (mainEnabled ? main.error : null) ?? (standardCards.length ? null : (trainers.error ?? energies.error)),
    retry: () => {
      for (const q of active) if (q.isError) void q.refetch()
      if (standard.isError) void standard.refetch()
    },
    hasMore: false,
    loadMore: () => {},
    isLoadingMore: false,
  }
}
