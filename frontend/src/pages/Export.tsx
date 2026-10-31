import { useState } from 'react'
import { FileDown, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { navigate } from '../lib/route'
import { api, downloadFile } from '../services/api'

export default function Export({ id }: { id?: number }) {
  const list = useAsync(() => api.listSimulations('', 100, 0), [])
  const [selected, setSelected] = useState<number | null>(id ?? null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = async (path: string, file: string) => {
    if (selected === null) return
    setBusy(true); setErr(null); setMsg(null)
    try { await downloadFile(path, file); setMsg(`Downloaded ${file}`) } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Download failed') } finally { setBusy(false) }
  }
  const sid = selected ?? 0
  const items = [
    { icon: FileSpreadsheet, label: 'CSV — time series', path: `/simulations/${sid}/export/csv?kind=timeseries`, file: `handoverlab_${sid}_timeseries.csv` },
    { icon: FileSpreadsheet, label: 'CSV — handover events', path: `/simulations/${sid}/export/csv?kind=events`, file: `handoverlab_${sid}_events.csv` },
    { icon: FileSpreadsheet, label: 'CSV — metrics', path: `/simulations/${sid}/export/csv?kind=metrics`, file: `handoverlab_${sid}_metrics.csv` },
    { icon: FileJson, label: 'JSON — full experiment', path: `/simulations/${sid}/export/json`, file: `handoverlab_${sid}.json` },
    { icon: FileText, label: 'PDF report', path: `/simulations/${sid}/report/pdf`, file: `handoverlab_${sid}.pdf` },
  ]

  return (
    <>
      <PageHeader title="Export Reports" subtitle="Downloads are generated from saved experiment data only; nothing is invented or recomputed." />
      <Card>
        {list.loading && <Spinner />}
        {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && <EmptyState title="Nothing to export" text="Run a simulation first." action={<Button onClick={() => navigate('new')}>New simulation</Button>} />}
        {list.data && list.data.items.length > 0 && (
          <div className="space-y-4">
            <div><label htmlFor="exp-sel" className="block text-sm font-medium">Experiment</label>
              <select id="exp-sel" value={selected ?? ''} onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full max-w-md rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm">
                <option value="">Select an experiment…</option>
                {list.data.items.map((e) => <option key={e.id} value={e.id}>#{e.id} {e.scenario_name}</option>)}
              </select></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ icon: Icon, label, path, file }) => (
                <Button key={label} variant="secondary" disabled={selected === null || busy} onClick={() => void go(path, file)}>
                  <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                </Button>
              ))}
            </div>
            {msg && <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><FileDown className="h-4 w-4" aria-hidden="true" />{msg}</p>}
            {err && <ErrorBanner message={err} />}
            <p className="text-xs text-slate-400">The PDF includes project and experiment information, assumptions, parameters, metrics, charts, comparison findings and limitations.</p>
          </div>
        )}
      </Card>
    </>
  )
}
