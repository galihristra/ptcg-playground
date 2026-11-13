import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { loadStandardData } from '../lib/standardData'
import type { ValidationContext } from '../lib/validation'

export function useStandardData() {
  return useQuery({ queryKey: ['standard-data'], queryFn: loadStandardData, staleTime: Infinity })
}

const EMPTY = new Set<string>()

/** Legality/validation context; empty sets until the Standard data has loaded. */
export function useValidationContext(): ValidationContext & { ready: boolean } {
  const { data } = useStandardData()
  return useMemo(
    () => ({ reprintNames: data?.reprintNames ?? EMPTY, aceSpecNames: data?.aceSpecNames ?? EMPTY, ready: !!data }),
    [data],
  )
}
