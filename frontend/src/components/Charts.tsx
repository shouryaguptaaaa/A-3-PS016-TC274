import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ALGO_COLOR, ALGO_LABEL, CELL_COLORS } from '../lib/format'
import type { AlgoName, SimResult } from '../types'

type Row = Record<string, number | null>

export interface LineSpec {
  key: string
  name: string
  color: string
  step?: boolean
  dashed?: boolean
}

const AXIS = { stroke: '#64748b', fontSize: 11 }
const TIP = { backgroundColor: '#0f1b36', border: '1px solid #1f3260', borderRadius: 8, fontSize: 12 }

export function MultiLine({ data, lines, xKey = 't', xLabel = 'Time (s)', yLabel, yDomain, refY, refXs = [], height = 280, integerY = false }: {
  data: Row[]
  lines: LineSpec[]
  xKey?: string
  xLabel?: string
  yLabel: string
  yDomain?: [number | 'auto', number | 'auto']
  refY?: { value: number; label: string }
  refXs?: Array<{ x: number; color: string }>
  height?: number
  integerY?: boolean
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 18 }}>
          <CartesianGrid stroke="#1f3260" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} type="number" domain={['dataMin', 'dataMax']} {...AXIS}
            label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 11 }} />
          <YAxis {...AXIS} domain={yDomain ?? ['auto', 'auto']} allowDecimals={!integerY} width={48}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={TIP} labelFormatter={(v) => `t = ${String(v)} s`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {refY && <ReferenceLine y={refY.value} stroke="#ef4444" strokeDasharray="5 5" label={{ value: refY.label, fill: '#f87171', fontSize: 10, position: 'insideTopRight' }} />}
          {refXs.map((r, i) => <ReferenceLine key={i} x={r.x} stroke={r.color} strokeOpacity={0.7} />)}
          {lines.map((l) => (
            <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} dot={false} strokeWidth={2}
              type={l.step ? 'stepAfter' : 'monotone'} strokeDasharray={l.dashed ? '4 3' : undefined}
              isAnimationActive={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function signalRows(result: SimResult, showMeasured: boolean): { rows: Row[]; lines: LineSpec[] } {
  const t = result.trajectory.time_s
  const n = result.metadata.num_cells
  const rows: Row[] = t.map((time, i) => {
    const r: Row = { t: time }
    for (let c = 0; c < n; c++) {
      r[`c${c}`] = result.signal.true_dbm[c][i]
      if (showMeasured) r[`m${c}`] = result.signal.measured_dbm[c][i]
    }
    return r
  })
  const lines: LineSpec[] = []
  for (let c = 0; c < n; c++) {
    lines.push({ key: `c${c}`, name: `Cell ${c} (true)`, color: CELL_COLORS[c % CELL_COLORS.length] })
    if (showMeasured) lines.push({ key: `m${c}`, name: `Cell ${c} (measured)`, color: CELL_COLORS[c % CELL_COLORS.length], dashed: true })
  }
  return { rows, lines }
}

export function SignalChart({ result, algo, threshold, showMeasured }: {
  result: SimResult
  algo: AlgoName
  threshold: number
  showMeasured: boolean
}) {
  const { rows, lines } = signalRows(result, showMeasured)
  const events = result.algorithms[algo]?.events ?? []
  const refXs = events
    .filter((e) => e.type === 'handover' && e.completion_time_s !== undefined)
    .map((e) => ({ x: e.completion_time_s as number, color: e.success ? '#34d399' : '#f87171' }))
  return (
    <MultiLine data={rows} lines={lines} yLabel="RSRP (dBm)" refY={{ value: threshold, label: 'min threshold' }} refXs={refXs} height={320} />
  )
}

export function UePositionChart({ result }: { result: SimResult }) {
  const rows: Row[] = result.trajectory.time_s.map((t, i) => ({ t, x: result.trajectory.x_m[i] }))
  return <MultiLine data={rows} lines={[{ key: 'x', name: 'UE position x (m)', color: '#fbbf24' }]} yLabel="Position (m)" height={220} />
}

export function ServingTimeline({ result }: { result: SimResult }) {
  const algos = Object.keys(result.algorithms) as AlgoName[]
  const rows: Row[] = result.trajectory.time_s.map((t, i) => {
    const r: Row = { t }
    for (const a of algos) {
      const v = result.algorithms[a]?.serving_cell[i]
      r[a] = v === undefined || v < 0 ? null : v
    }
    return r
  })
  const lines: LineSpec[] = algos.map((a) => ({ key: a, name: ALGO_LABEL[a], color: ALGO_COLOR[a], step: true }))
  return <MultiLine data={rows} lines={lines} yLabel="Serving cell" yDomain={[0, Math.max(1, result.metadata.num_cells - 1)]} integerY height={220} />
}

export function CompareBars({ data, yLabel, percent = false, height = 220 }: {
  data: Array<{ name: string; baseline: number | null; proposed: number | null }>
  yLabel: string
  percent?: boolean
  height?: number
}) {
  const shown = data.map((d) => ({
    name: d.name,
    baseline: d.baseline === null ? 0 : percent ? d.baseline * 100 : d.baseline,
    proposed: d.proposed === null ? 0 : percent ? d.proposed * 100 : d.proposed,
  }))
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={shown} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#1f3260" strokeDasharray="3 3" />
          <XAxis dataKey="name" {...AXIS} />
          <YAxis {...AXIS} width={48} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip contentStyle={TIP} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="baseline" name="Baseline" fill={ALGO_COLOR.baseline} isAnimationActive={false} />
          <Bar dataKey="proposed" name="Proposed" fill={ALGO_COLOR.proposed} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
