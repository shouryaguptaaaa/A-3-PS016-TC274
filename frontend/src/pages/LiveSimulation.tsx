import { useMemo } from 'react'
import { Ban, Pause, Play } from 'lucide-react'
import { MultiLine, type LineSpec } from '../components/Charts'
import EventsTable from '../components/EventsTable'
import TopologyView, { type HandoverMark } from '../components/TopologyView'
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, SimNotice } from '../components/ui'
import type { JobState } from '../hooks/useJob'
import { ALGO_LABEL, CELL_COLORS, fmtNum } from '../lib/format'
import { navigate } from '../lib/route'
import { DEFAULT_CONFIG } from '../lib/validation'
import type { AlgoName, CellInfo, LiveSample, SimEvent } from '../types'

export function liveMarks(events: SimEvent[], algo: AlgoName, samples: LiveSample[]): HandoverMark[] {
  return events
    .filter((e) => e.algorithm === algo && e.type === 'handover' && e.completion_time_s !== undefined)
    .map((e) => {
      const s = samples.find((x) => x.t >= (e.completion_time_s as number)) ?? samples[samples.length - 1]
      return { x: s ? s.x : 0, y: s ? s.y : 0, success: Boolean(e.success), label: `Handover ${e.source_cell}→${e.target_cell} at ${fmtNum(e.completion_time_s, 1)} s (${e.success ? 'success' : 'failed'})` }
    })
}

const STATUS_TONE = { running: 'cyan', paused: 'amber', completed: 'green', cancelled: 'slate', failed: 'red' } as const

export default function LiveSimulation({ job, algo, setAlgo }: { job: JobState; algo: AlgoName; setAlgo: (a: AlgoName) => void }) {
  const { snap, samples, error } = job
  const last = samples.length > 0 ? samples[samples.length - 1] : null
  const cells: CellInfo[] = snap?.cells ?? []
  const algos = snap?.algorithms ?? []
  const activeAlgo: AlgoName = algos.includes(algo) ? algo : algos[0] ?? 'baseline'

  const { rows, lines } = useMemo(() => {
    const n = cells.length
    const r = samples.map((s) => {
      const row: Record<string, number | null> = { t: s.t }
      for (let c = 0; c < n; c++) row[`c${c}`] = s.true[c]
      return row
    })
    const l: LineSpec[] = cells.map((c) => ({ key: `c${c.id}`, name: `Cell ${c.id}`, color: CELL_COLORS[c.id % CELL_COLORS.length] }))
    return { rows: r, lines: l }
  }, [samples, cells])

  if (!snap && !error) {
    return (
      <>
        <PageHeader title="Live Simulation" subtitle="Watch a backend run advance step by step." />
        <EmptyState title="No simulation is running" text="Start a live run from the New Simulation page. Progress here comes from the real backend computation."
          action={<div className="flex gap-2"><Button onClick={() => navigate('new')}>Configure a run</Button>
            <Button variant="secondary" disabled={job.busy} onClick={() => void job.start(DEFAULT_CONFIG, 150)}>Start with defaults</Button></div>} />
      </>
    )
  }

  const status = snap?.status ?? 'failed'
  const active = status === 'running' || status === 'paused'
  const pct = Math.round((snap?.progress.fraction ?? 0) * 100)
  const algoState = last?.algos[activeAlgo]
  const serving = algoState && algoState.serving >= 0 ? algoState.serving : null

  return (
    <>
      <PageHeader title="Live Simulation" subtitle={snap ? `${snap.scenario_name} — step ${snap.progress.step} of ${snap.progress.total_steps}` : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
          {status === 'running' && <Button variant="secondary" onClick={() => void job.control('pause')}><Pause className="h-4 w-4" aria-hidden="true" /> Pause</Button>}
          {status === 'paused' && <Button onClick={() => void job.control('resume')}><Play className="h-4 w-4" aria-hidden="true" /> Resume</Button>}
          {active && <Button variant="danger" onClick={() => void job.control('cancel')}><Ban className="h-4 w-4" aria-hidden="true" /> Cancel</Button>}
          {status === 'completed' && snap?.experiment_id != null && <Button onClick={() => navigate(`results/${snap.experiment_id}`)}>View results</Button>}
          {!active && <Button variant="secondary" onClick={() => navigate('new')}>New run</Button>}
        </div>
      </PageHeader>

      <div className="space-y-4">
        <SimNotice />
        {error && <ErrorBanner message={error} />}
        {snap?.error && <ErrorBanner message={snap.error} />}
        {status === 'cancelled' && <p className="text-sm text-slate-400">This run was cancelled and was not saved.</p>}

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Progress (real simulation steps)</span><span>{pct}%</span></div>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Simulation progress" className="h-2.5 overflow-hidden rounded-full bg-navy-700">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Network topology" className="lg:col-span-2" actions={algos.length > 1 ? (
            <div className="flex gap-1" role="group" aria-label="Algorithm shown">
              {algos.map((a) => <Button key={a} variant={a === activeAlgo ? 'primary' : 'secondary'} onClick={() => setAlgo(a)}>{ALGO_LABEL[a]}</Button>)}
            </div>
          ) : undefined}>
            {cells.length > 0 && snap ? (
              <TopologyView cells={cells} coverageRadius={snap.coverage_radius_m} ue={last ? { x: last.x, y: last.y } : null}
                serving={serving} signals={last?.true ?? null} trail={samples.map((s) => ({ x: s.x, y: s.y }))}
                marks={liveMarks(snap.events, activeAlgo, samples)} state={algoState?.state ?? null} />
            ) : <p className="text-sm text-slate-400">Waiting for the first samples…</p>}
          </Card>
          <Card title="Current state">
            {last ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-400">Time</dt><dd className="tabular-nums">{fmtNum(last.t, 1)} s</dd>
                <dt className="text-slate-400">UE position</dt><dd className="tabular-nums">{fmtNum(last.x, 0)} m</dd>
                {algos.map((a) => {
                  const st = last.algos[a]
                  const sv = st && st.serving >= 0 ? st.serving : null
                  return (
                    <div key={a} className="col-span-2 rounded-lg bg-navy-900 p-2">
                      <p className="text-xs font-semibold text-cyan-300">{ALGO_LABEL[a]}</p>
                      <p>Serving cell: <b>{sv === null ? 'none' : sv}</b> · {st?.state}</p>
                      <p className="text-slate-300">Signal: {sv === null ? 'n/a' : `${fmtNum(last.true[sv], 1)} dBm (measured ${fmtNum(last.meas[sv], 1)})`}</p>
                    </div>
                  )
                })}
              </dl>
            ) : <p className="text-sm text-slate-400">No samples yet.</p>}
          </Card>
        </div>

        <Card title="Signal strength over time" subtitle="True received power per cell, from backend output.">
          {rows.length > 1 ? <MultiLine data={rows} lines={lines} yLabel="RSRP (dBm)" refY={snap ? { value: snap.min_signal_dbm, label: 'min threshold' } : undefined} height={280} /> : <p className="text-sm text-slate-400">Collecting data…</p>}
        </Card>
        <Card title="Handover events so far">
          <EventsTable events={snap?.events ?? []} emptyText="No handover events yet." />
        </Card>
      </div>
    </>
  )
}
