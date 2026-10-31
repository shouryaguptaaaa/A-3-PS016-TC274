import { useEffect, useMemo, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { MultiLine, signalRows } from '../components/Charts'
import TopologyView, { type HandoverMark } from '../components/TopologyView'
import { Button, Card, ErrorBanner, PageHeader, SimNotice, Spinner } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import type { JobState } from '../hooks/useJob'
import { ALGO_LABEL, fmtNum } from '../lib/format'
import { DEFAULT_CONFIG } from '../lib/validation'
import { api } from '../services/api'
import type { AlgoName, CellInfo } from '../types'

function previewRadius(): number {
  const c = DEFAULT_CONFIG
  const exp = (c.tx_power_dbm - c.min_signal_dbm - c.path_loss_ref_db) / (10 * c.path_loss_exponent)
  return c.reference_distance_m * 10 ** exp
}

export default function Topology({ job, algo, setAlgo }: { job: JobState; algo: AlgoName; setAlgo: (a: AlgoName) => void }) {
  const [mode, setMode] = useState<'preview' | 'replay' | 'live'>('preview')
  const [cellCount, setCellCount] = useState('3')
  const [spacing, setSpacing] = useState('500')
  const [expId, setExpId] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const list = useAsync(() => api.listSimulations('', 50, 0), [])
  const detail = useAsync(() => (expId === null ? Promise.resolve(null) : api.getSimulation(expId)), [expId])
  const res = detail.data?.result ?? null
  const total = res ? res.trajectory.time_s.length : 0

  useEffect(() => {
    if (!playing || total === 0) return
    const id = window.setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [playing, total])

  const n = Math.min(10, Math.max(2, Math.round(Number(cellCount)) || 3))
  const sp = Math.min(5000, Math.max(100, Number(spacing) || 500))
  const previewCells: CellInfo[] = useMemo(() => Array.from({ length: n }, (_, i) => ({ id: i, x_m: i * sp, y_m: 30 })), [n, sp])

  const activeAlgo: AlgoName = res && !res.algorithms[algo] ? ((Object.keys(res.algorithms)[0] as AlgoName) ?? algo) : algo
  const liveLast = job.samples.length > 0 ? job.samples[job.samples.length - 1] : null

  let view
  if (mode === 'replay' && res) {
    const a = res.algorithms[activeAlgo]
    const i = Math.min(idx, total - 1)
    const sv = a ? a.serving_cell[i] : -1
    const t = res.trajectory.time_s[i]
    const marks: HandoverMark[] = (a?.events ?? [])
      .filter((e) => e.type === 'handover' && (e.completion_time_s ?? Infinity) <= t)
      .map((e) => {
        const k = res.trajectory.time_s.findIndex((x) => x >= (e.completion_time_s as number))
        return { x: res.trajectory.x_m[k], y: 0, success: Boolean(e.success), label: `Handover ${e.source_cell}→${e.target_cell} at ${fmtNum(e.completion_time_s, 1)} s` }
      })
    view = (
      <TopologyView cells={res.metadata.cells} coverageRadius={res.metadata.coverage_radius_m} ue={{ x: res.trajectory.x_m[i], y: res.trajectory.y_m[i] }}
        serving={sv >= 0 ? sv : null} signals={res.signal.true_dbm.map((s) => s[i])} state={a?.state[i]}
        trail={res.trajectory.x_m.slice(0, i + 1).map((x, k) => ({ x, y: res.trajectory.y_m[k] }))} marks={marks} />
    )
  } else if (mode === 'live' && job.snap && liveLast) {
    const st = liveLast.algos[algo] ?? Object.values(liveLast.algos)[0]
    view = (
      <TopologyView cells={job.snap.cells} coverageRadius={job.snap.coverage_radius_m} ue={{ x: liveLast.x, y: liveLast.y }}
        serving={st && st.serving >= 0 ? st.serving : null} signals={liveLast.true} state={st?.state}
        trail={job.samples.map((s) => ({ x: s.x, y: s.y }))} />
    )
  } else {
    view = <TopologyView cells={previewCells} coverageRadius={previewRadius()} />
  }

  const sig = res && mode === 'replay' ? signalRows(res, false) : null

  return (
    <>
      <PageHeader title="Network Topology" subtitle="Interactive map of the simulated corridor: cells, coverage, the moving UE and handovers. Hover or tap shapes for details." />
      <div className="space-y-4">
        <SimNotice />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Topology source">
          {([['preview', 'Network preview'], ['replay', 'Replay saved experiment'], ['live', 'Live run']] as const).map(([m, label]) => (
            <Button key={m} variant={mode === m ? 'primary' : 'secondary'} onClick={() => setMode(m)} role="tab" aria-selected={mode === m}>{label}</Button>
          ))}
        </div>

        {mode === 'preview' && (
          <Card title="Configure preview">
            <div className="flex flex-wrap gap-4">
              <div><label htmlFor="pv-cells" className="block text-sm">Number of cells (2-10)</label>
                <input id="pv-cells" value={cellCount} onChange={(e) => setCellCount(e.target.value)} inputMode="numeric" className="mt-1 w-28 rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm" /></div>
              <div><label htmlFor="pv-sp" className="block text-sm">Cell spacing (m)</label>
                <input id="pv-sp" value={spacing} onChange={(e) => setSpacing(e.target.value)} inputMode="numeric" className="mt-1 w-28 rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm" /></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Preview uses the default radio parameters. Set the real values in New Simulation.</p>
          </Card>
        )}
        {mode === 'replay' && (
          <Card title="Replay controls" subtitle="Plays back saved backend output; nothing is recomputed here.">
            {list.error && <ErrorBanner message={list.error} onRetry={list.reload} />}
            {list.loading && <Spinner />}
            {list.data && list.data.items.length === 0 && <p className="text-sm text-slate-400">No saved experiments yet. Run a simulation first.</p>}
            {list.data && list.data.items.length > 0 && (
              <div className="flex flex-wrap items-end gap-3">
                <div><label htmlFor="exp" className="block text-sm">Experiment</label>
                  <select id="exp" value={expId ?? ''} onChange={(e) => { setExpId(e.target.value ? Number(e.target.value) : null); setIdx(0); setPlaying(false) }} className="mt-1 rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm">
                    <option value="">Select…</option>
                    {list.data.items.map((e) => <option key={e.id} value={e.id}>#{e.id} {e.scenario_name}</option>)}
                  </select></div>
                {res && Object.keys(res.algorithms).length > 1 && (
                  <div><label htmlFor="alg" className="block text-sm">Algorithm</label>
                    <select id="alg" value={activeAlgo} onChange={(e) => setAlgo(e.target.value as AlgoName)} className="mt-1 rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm">
                      {(Object.keys(res.algorithms) as AlgoName[]).map((a) => <option key={a} value={a}>{ALGO_LABEL[a]}</option>)}
                    </select></div>
                )}
                {res && (
                  <>
                    <Button variant="secondary" onClick={() => { if (idx >= total - 1) setIdx(0); setPlaying((p) => !p) }}>
                      {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}{playing ? 'Pause' : 'Play'}
                    </Button>
                    <div className="min-w-[200px] flex-1"><label htmlFor="scrub" className="block text-sm">Time: {fmtNum(res.trajectory.time_s[Math.min(idx, total - 1)], 1)} s</label>
                      <input id="scrub" type="range" min={0} max={total - 1} value={Math.min(idx, total - 1)} onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false) }} className="w-full accent-cyan-400" /></div>
                  </>
                )}
              </div>
            )}
            {detail.loading && expId !== null && <Spinner />}
            {detail.error && <ErrorBanner message={detail.error} />}
          </Card>
        )}
        {mode === 'live' && !liveLast && <p className="text-sm text-slate-400">No live run in progress. Start one from New Simulation.</p>}

        <Card title="Topology">{view}</Card>

        {sig && res && (
          <Card title="Signal strength over time (true RSRP)">
            <MultiLine data={sig.rows} lines={sig.lines} yLabel="RSRP (dBm)" height={260}
              refY={{ value: Number(detail.data?.config.min_signal_dbm ?? -110), label: 'min threshold' }} />
          </Card>
        )}
      </div>
    </>
  )
}
