import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getCard, searchCards } from '../../lib/cards'
import { parseDecklist, serializeDecklist } from '../../lib/decklist'
import { resolveDecklist, type UnmatchedLine } from '../../lib/importResolve'
import { totalCards } from '../../lib/validation'
import { useDeckStore } from '../../store/deckStore'
import { useUiStore } from '../../store/uiStore'
import { useDeckEntries } from '../deck/useDeckActions'
import { abbrForSet, ensureAbbrs, setIdForAbbr } from './abbr'

type Mode = 'import' | 'export'

const tabClass = (on: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${on ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`

export function ImportExportDialog({ initialMode, onClose }: { initialMode: Mode; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const entries = useDeckEntries()
  const showToast = useUiStore((s) => s.showToast)
  const dialogRef = useRef<HTMLDivElement>(null)

  // ---- export ----
  const setIds = entries.map((e) => e.card.set.id)
  const exported = useQuery({
    queryKey: ['export', entries.map((e) => `${e.card.id}x${e.count}`).join(',')],
    queryFn: async () => {
      await ensureAbbrs(setIds)
      return serializeDecklist(entries, abbrForSet)
    },
    enabled: mode === 'export',
    staleTime: 0,
  })

  // ---- import ----
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [unmatched, setUnmatched] = useState<UnmatchedLine[] | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  const runImport = async () => {
    setBusy(true)
    setUnmatched(null)
    setImported(null)
    try {
      const result = await resolveDecklist(parseDecklist(text), {
        getCard,
        searchByName: (name) => searchCards({ name: name.replace(/^basic\s+/i, '') }),
        setIdForAbbr,
      })
      if (result.entries.length > 0) useDeckStore.getState().replaceEntries(result.entries)
      setUnmatched(result.unmatched)
      setImported(totalCards(result.entries))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exported.data ?? '')
      showToast('Decklist copied to clipboard.')
    } catch {
      showToast('Copy failed — select the text and copy it manually.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Import or export decklist">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={dialogRef} tabIndex={-1} className="relative flex max-h-full w-full max-w-xl flex-col rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div role="tablist" className="flex gap-1">
            <button role="tab" aria-selected={mode === 'import'} type="button" className={tabClass(mode === 'import')} onClick={() => setMode('import')}>
              Import
            </button>
            <button role="tab" aria-selected={mode === 'export'} type="button" className={tabClass(mode === 'export')} onClick={() => setMode('export')}>
              Export
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800">
            ✕
          </button>
        </div>

        {mode === 'export' ? (
          <>
            <p className="mb-2 text-sm text-slate-400">PTCG Live-style text list for the current deck.</p>
            <textarea
              readOnly
              aria-label="Exported decklist"
              className="h-72 w-full resize-none rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs"
              value={exported.isLoading ? 'Preparing…' : (exported.data ?? '')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="mt-3 flex justify-end">
              <button type="button" disabled={!exported.data} onClick={() => void copy()} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                Copy to clipboard
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-400">
              Paste a PTCG Live-style list (<code className="text-slate-300">4 Pikachu ex SSP 57</code>). This replaces the cards in the current deck.
            </p>
            <textarea
              aria-label="Decklist to import"
              className="h-56 w-full resize-none rounded-md border border-slate-700 bg-slate-900 p-2 font-mono text-xs"
              placeholder={'Pokémon: 4\n4 Raging Bolt ex TEF 123\n\nTrainer: 1\n1 Prime Catcher TEF 157\n\nEnergy: 6\n6 Basic {G} Energy SVE 9'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div aria-live="polite" className="mt-2 max-h-40 overflow-y-auto text-sm">
              {imported != null && (
                <p className={unmatched?.length ? 'text-amber-300' : 'text-emerald-300'}>
                  Imported {imported} card{imported === 1 ? '' : 's'}
                  {unmatched?.length ? `, ${unmatched.length} line${unmatched.length === 1 ? '' : 's'} not matched:` : ' — every line matched.'}
                </p>
              )}
              {unmatched?.map((u) => (
                <p key={u.line} className="font-mono text-xs text-red-300">
                  line {u.line}: {u.raw} <span className="text-slate-500">({u.reason})</span>
                </p>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                {imported != null ? 'Done' : 'Cancel'}
              </button>
              <button type="button" disabled={busy || !text.trim()} onClick={() => void runImport()} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                {busy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
