import TCGdex from '@tcgdex/sdk'

// Single shared SDK instance. TCGdex asks clients to cache, so keep responses for a day.
export const tcgdex = new TCGdex('en')
tcgdex.setCacheTTL(60 * 60 * 24)
