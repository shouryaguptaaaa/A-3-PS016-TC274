import { useEffect, useState } from 'react'
import { BarChart3, Download, Eye, Search, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { ALGO_LABEL, fmtDate } from '../lib/format'
import { navigate } from '../lib/route'
import { api } from '../services/api'

const PAGE = 25

export default function History() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => { setQuery(search); setPage(0) }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  const { data, error, loading, reload } = useAsync(() => api.listSimulations(query, PAGE, page * PAGE), [query, page])

  const remove = async (id: number, name: string) => {
    if (!window.confirm(`Delete experiment #${id} "${name}"? This cannot be undone.`)) return
    setActionError(null)
    try { await api.deleteSimulation(id); reload() } catch (e: unknown) { setActionError(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <>
      <PageHeader title="Experiment History" subtitle="All saved experiments. Search by scenario name or ID." />
      <Card>
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor="hist-search" className="sr-only">Search experiments</label>
          <input id="hist-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search scenario or ID…" maxLength={100}
            className="w-full rounded-lg border border-navy-600 bg-navy-900 py-2 pl-9 pr-3 text-sm" />
        </div>
        {loading && <Spinner />}
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {actionError && <ErrorBanner message={actionError} />}
        {data && data.total === 0 && (
          <EmptyState title={query ? 'No matching experiments' : 'No experiments yet'} text={query ? 'Try a different search.' : 'Run a simulation to start your history.'}
            action={!query ? <Button onClick={() => navigate('new')}>New simulation</Button> : undefined} />
        )}
        {data && data.total > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-400"><tr>
                  <th scope="col" className="py-2 pr-3">ID</th><th scope="col" className="pr-3">Scenario</th><th scope="col" className="pr-3">Timestamp</th>
                  <th scope="col" className="pr-3">Speed</th><th scope="col" className="pr-3">Cells</th><th scope="col" className="pr-3">Algorithms</th>
                  <th scope="col" className="pr-3">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id} className="border-t border-navy-600/60">
                      <td className="py-2 pr-3 tabular-nums">#{e.id}</td><td className="pr-3">{e.scenario_name}</td><td className="pr-3">{fmtDate(e.created_at)}</td>
                      <td className="pr-3 tabular-nums">{e.speed_kmh} km/h</td><td className="pr-3">{e.num_cells}</td>
                      <td className="pr-3">{e.algorithms.map((a) => ALGO_LABEL[a]).join(', ')}</td>
                      <td className="pr-3"><Badge tone="green">{e.status}</Badge></td>
                      <td><div className="flex gap-1">
                        <Button variant="ghost" aria-label={`View experiment ${e.id}`} onClick={() => navigate(`results/${e.id}`)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" aria-label={`Compare experiment ${e.id}`} onClick={() => navigate(`results/${e.id}/compare`)}><BarChart3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" aria-label={`Export experiment ${e.id}`} onClick={() => navigate(`export/${e.id}`)}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" aria-label={`Delete experiment ${e.id}`} onClick={() => void remove(e.id, e.scenario_name)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
              <span>{data.total} experiment{data.total === 1 ? '' : 's'}</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="secondary" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
