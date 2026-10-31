import { useEffect, useState } from 'react'
import { CompareBars, ServingTimeline, SignalChart, UePositionChart } from '../components/Charts'
import ComparisonTable from '../components/ComparisonTable'
import EventsTable from '../components/EventsTable'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, SimNotice, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { ALGO_LABEL, fmtDate, fmtNum, fmtPct } from '../lib/format'
import { navigate } from '../lib/route'
import { api } from '../services/api'
import type { AlgoName, ComparisonRow, ExperimentDetail, ExperimentSummary } from '../types'

export function summarizeComparison(rows: ComparisonRow[]): string {
  const c = { baseline: 0, proposed: 0, tie: 0, na: 0 }
  for (const r of rows) {
    if (r.winner === 'baseline') c.baseline++
    else if (r.winner === 'proposed') c.proposed++
    else if (r.winner === 'tie') c.tie++
    else c.na++
  }
  return `Across ${rows.length} compared metrics in this simulated scenario: the proposed strategy was better on ${c.proposed}, the baseline on ${c.baseline}, ${c.tie} tied and ${c.na} not defined. These findings apply to this scenario and seed only; they are not real-network measurements and not evidence of general superiority.`
}

function DelayTable({ detail }: { detail: ExperimentDetail }) {
  const algos = Object.keys(detail.result.algorithms) as AlgoName[]
  const kinds = [['execution_delay_s', 'Execution delay'], ['decision_delay_s', 'Decision delay'], ['total_delay_s', 'Total delay']] as const
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-400"><tr>
          <th scope="col" className="py-2 pr-3">Algorithm / delay</th><th scope="col" className="pr-3">n</th><th scope="col" className="pr-3">Mean</th>
          <th scope="col" className="pr-3">Median</th><th scope="col" className="pr-3">Min</th><th scope="col" className="pr-3">Max</th><th scope="col">Std</th></tr></thead>
        <tbody>
          {algos.flatMap((a) => kinds.map(([k, label]) => {
            const s = detail.result.algorithms[a]?.metrics[k]
            if (!s) return null
            return (
              <tr key={`${a}-${k}`} className="border-t border-navy-600/60">
                <th scope="row" className="py-1.5 pr-3 font-normal">{ALGO_LABEL[a]} · {label}</th>
                <td className="pr-3 tabular-nums">{s.n}</td>
                {[s.mean, s.median, s.min, s.max, s.std].map((v, i) => <td key={i} className="pr-3 tabular-nums">{v === null ? 'n/a' : `${fmtNum(v)} s`}</td>)}
              </tr>
            )
          }))}
        </tbody>
      </table>
    </div>
  )
}

function CompareSaved({ initialId }: { initialId?: number }) {
  const list = useAsync(() => api.listSimulations('', 100, 0), [])
  const [sel, setSel] = useState<number[]>(initialId ? [initialId] : [])
  const [out, setOut] = useState<ExperimentSummary[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (id: number) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 6 ? [...p, id] : p))
  const run = async () => {
    setBusy(true); setErr(null)
    try { setOut((await api.compare(sel)).experiments) } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Comparison failed') } finally { setBusy(false) }
  }

  return (
    <Card title="Compare saved experiments" subtitle="Select 2-6 experiments. Values are read from saved results; nothing is re-simulated.">
      {list.loading && <Spinner />}
      {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}
      {list.data && list.data.items.length < 2 && <p className="text-sm text-slate-400">Save at least two experiments to compare them.</p>}
      {list.data && list.data.items.length >= 2 && (
        <>
          <ul className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">
            {list.data.items.map((e) => (
              <li key={e.id}><label className="flex min-h-[40px] items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.includes(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-cyan-400" />
                #{e.id} {e.scenario_name} <span className="text-xs text-slate-500">({e.speed_kmh} km/h, seed {e.seed})</span></label></li>
            ))}
          </ul>
          <Button className="mt-3" disabled={sel.length < 2 || busy} onClick={() => void run()}>Compare {sel.length} selected</Button>
        </>
      )}
      {err && <div className="mt-3"><ErrorBanner message={err} /></div>}
      {out && (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400"><tr>
                <th scope="col" className="py-2 pr-3">Experiment</th><th scope="col" className="pr-3">Speed</th><th scope="col" className="pr-3">Algorithm</th>
                <th scope="col" className="pr-3">Handovers</th><th scope="col" className="pr-3">Failure rate</th><th scope="col" className="pr-3">Ping-pong rate</th><th scope="col">Outage</th></tr></thead>
              <tbody>
                {out.flatMap((e) => (Object.keys(e.metrics) as AlgoName[]).map((a) => {
                  const m = e.metrics[a]
                  if (!m) return null
                  return (
                    <tr key={`${e.id}-${a}`} className="border-t border-navy-600/60">
                      <td className="py-1.5 pr-3">#{e.id} {e.scenario_name}</td><td className="pr-3">{e.speed_kmh} km/h</td><td className="pr-3">{ALGO_LABEL[a]}</td>
                      <td className="pr-3 tabular-nums">{m.handover_count}</td><td className="pr-3 tabular-nums">{fmtPct(m.failure_rate)}</td>
                      <td className="pr-3 tabular-nums">{fmtPct(m.ping_pong_rate)}</td><td className="tabular-nums">{fmtNum(m.outage_duration_s)} s</td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
          <h3 className="text-sm font-medium text-slate-300">Successful handovers per experiment</h3>
          <CompareBars yLabel="Handovers" data={out.map((e) => ({ name: `#${e.id}`, baseline: e.metrics.baseline?.handover_count ?? null, proposed: e.metrics.proposed?.handover_count ?? null }))} />
        </div>
      )}
    </Card>
  )
}

export default function Results({ id, compareMode }: { id?: number; compareMode: boolean }) {
  const { data, error, loading, reload } = useAsync(() => (id ? api.getSimulation(id) : Promise.resolve(null)), [id])
  const list = useAsync(() => api.listSimulations('', 50, 0), [])
  const [algo, setAlgo] = useState<AlgoName>('proposed')
  const [showMeasured, setShowMeasured] = useState(false)

  useEffect(() => {
    if (data && !data.result.algorithms[algo]) setAlgo((Object.keys(data.result.algorithms)[0] as AlgoName) ?? 'baseline')
  }, [data, algo])

  if (!id) {
    return (
      <>
        <PageHeader title="Results & Comparison" subtitle="Select a saved experiment to inspect it." />
        {list.loading && <Spinner />}
        {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && <EmptyState title="No saved experiments" text="Run a simulation to create results." action={<Button onClick={() => navigate('new')}>New simulation</Button>} />}
        {list.data && list.data.items.length > 0 && (
          <Card><ul className="divide-y divide-navy-600/60">
            {list.data.items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>#{e.id} {e.scenario_name} <span className="text-xs text-slate-500">· {fmtDate(e.created_at)}</span></span>
                <Button variant="secondary" onClick={() => navigate(`results/${e.id}`)}>Open</Button></li>
            ))}</ul></Card>
        )}
        <div className="mt-4"><CompareSaved /></div>
      </>
    )
  }

  const threshold = data?.config.min_signal_dbm ?? -110

  return (
    <>
      <PageHeader title={data ? `Results — #${data.id} ${data.scenario_name}` : 'Results'} subtitle={data ? `${fmtDate(data.created_at)} · seed ${data.seed} · ${data.speed_kmh} km/h · ${data.num_cells} cells` : undefined}>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => navigate('results')}>Choose another</Button><Button variant="secondary" onClick={() => navigate(`export/${id}`)}>Export</Button></div>
      </PageHeader>
      <div className="space-y-4">
        <SimNotice />
        {loading && <Spinner />}
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {data && (
          <>
            <Card title="Baseline vs proposed" subtitle="Paired comparison: identical mobility and measurement noise for both algorithms. Lower is better for every metric.">
              <p className="mb-3 text-sm text-slate-300">{summarizeComparison(data.result.comparison)}</p>
              <ComparisonTable rows={data.result.comparison} />
            </Card>

            {data.result.comparison.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {([['handover_count', 'Handover count', false, 'Count'], ['failure_rate', 'Failure rate', true, '%'], ['ping_pong_rate', 'Ping-pong rate', true, '%'], ['outage_duration_s', 'Outage duration', false, 'Seconds']] as const).map(([key, title, pct, yl]) => {
                  const row = data.result.comparison.find((r) => r.metric === key)
                  if (!row) return null
                  return <Card key={key} title={title}><CompareBars yLabel={yl} percent={pct} data={[{ name: title, baseline: row.baseline, proposed: row.proposed }]} /></Card>
                })}
              </div>
            )}

            <Card title="Signal strength vs time" subtitle="Vertical lines mark handover completions (green = success, red = failed) for the selected algorithm."
              actions={<div className="flex flex-wrap items-center gap-3">
                {(Object.keys(data.result.algorithms) as AlgoName[]).length > 1 && (
                  <select aria-label="Algorithm for markers" value={algo} onChange={(e) => setAlgo(e.target.value as AlgoName)} className="rounded-lg border border-navy-600 bg-navy-900 px-2 py-1.5 text-sm">
                    {(Object.keys(data.result.algorithms) as AlgoName[]).map((a) => <option key={a} value={a}>{ALGO_LABEL[a]}</option>)}
                  </select>)}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showMeasured} onChange={(e) => setShowMeasured(e.target.checked)} className="accent-cyan-400" />Show noisy measurements</label>
              </div>}>
              <SignalChart result={data.result} algo={algo} threshold={threshold} showMeasured={showMeasured} />
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="UE position vs time"><UePositionChart result={data.result} /></Card>
              <Card title="Serving-cell timeline" subtitle="Gaps mean no serving cell (outage/re-establishment)."><ServingTimeline result={data.result} /></Card>
            </div>
            <Card title="Handover events"><EventsTable events={(Object.values(data.result.algorithms).flatMap((a) => a?.events ?? []))} /></Card>
            <Card title="Execution & decision delay statistics" subtitle="Per completed handover attempt. Execution delay is the configured delay rounded up to whole time steps."><DelayTable detail={data} /></Card>
            <Card title="Experiment parameters">
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.config).map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b border-navy-600/40 py-1"><dt className="text-slate-400">{k}</dt><dd className="tabular-nums">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs text-slate-400">{data.result.metadata.disclaimer}</p>
            </Card>
          </>
        )}
        {(compareMode || data) && <CompareSaved initialId={id} />}
      </div>
    </>
  )
}
