import type { CellInfo } from '../types'
import { CELL_COLORS } from '../lib/format'

export interface HandoverMark {
  x: number
  y: number
  success: boolean
  label: string
}

export interface TopologyProps {
  cells: CellInfo[]
  coverageRadius: number
  ue?: { x: number; y: number } | null
  serving?: number | null
  signals?: number[] | null
  trail?: Array<{ x: number; y: number }>
  marks?: HandoverMark[]
  state?: string | null
}

/** SVG map in metre units; the map is a simulation, not a real network. */
export default function TopologyView({ cells, coverageRadius, ue, serving, signals, trail = [], marks = [], state }: TopologyProps) {
  const xs = cells.map((c) => c.x_m)
  const minX = Math.min(...xs) - coverageRadius * 0.4
  const maxX = Math.max(...xs) + coverageRadius * 0.4
  const ueMax = ue ? ue.x : maxX
  const right = Math.max(maxX, ueMax + coverageRadius * 0.1)
  const width = right - minX
  const top = -coverageRadius
  const height = Math.max(...cells.map((c) => c.y_m)) + coverageRadius * 2
  const u = width / 100 // one "unit" for fonts and markers

  return (
    <figure className="m-0">
      <svg
        viewBox={`${minX} ${top} ${width} ${height}`}
        role="img"
        aria-label={`Simulated network map with ${cells.length} cells${serving !== null && serving !== undefined && serving >= 0 ? `; UE served by cell ${serving}` : ''}`}
        className="h-auto w-full rounded-lg bg-navy-900"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>Simulated cellular network (not a live network)</title>
        {cells.map((c) => {
          const isServing = serving === c.id
          const color = CELL_COLORS[c.id % CELL_COLORS.length]
          return (
            <g key={c.id}>
              <circle cx={c.x_m} cy={c.y_m} r={coverageRadius} fill={color} fillOpacity={isServing ? 0.16 : 0.06}
                stroke={color} strokeOpacity={isServing ? 0.9 : 0.4} strokeWidth={isServing ? 2.5 : 1} vectorEffect="non-scaling-stroke"
                strokeDasharray={isServing ? undefined : '6 4'}>
                <title>{`Cell ${c.id} coverage (mean RSRP ≥ threshold within ${coverageRadius.toFixed(0)} m)${isServing ? ' — serving' : ''}`}</title>
              </circle>
              <rect x={c.x_m - u * 0.9} y={c.y_m - u * 0.9} width={u * 1.8} height={u * 1.8} fill={color} rx={u * 0.3}>
                <title>{`Cell ${c.id} base station at x=${c.x_m.toFixed(0)} m`}</title>
              </rect>
              <text x={c.x_m} y={c.y_m - u * 1.6} textAnchor="middle" fontSize={u * 1.9} fill="#e2e8f0">
                {`Cell ${c.id}${isServing ? ' (serving)' : ''}`}
              </text>
              {signals && signals[c.id] !== undefined && (
                <text x={c.x_m} y={c.y_m + u * 3.4} textAnchor="middle" fontSize={u * 1.7} fill={color}>
                  {`${signals[c.id].toFixed(0)} dBm`}
                </text>
              )}
            </g>
          )
        })}
        <line x1={minX} y1={0} x2={right} y2={0} stroke="#475569" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {trail.length > 1 && (
          <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fbbf24" strokeOpacity={0.6}
            strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )}
        {marks.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y - u * 2.2})`}>
            <polygon points={`0,${-u} ${u},0 0,${u} ${-u},0`} fill={m.success ? '#34d399' : '#f87171'}>
              <title>{m.label}</title>
            </polygon>
          </g>
        ))}
        {ue && (
          <g>
            <circle cx={ue.x} cy={ue.y} r={u * 1.3} fill="#fbbf24" stroke="#0a1226" strokeWidth={2} vectorEffect="non-scaling-stroke">
              <title>{`UE at x=${ue.x.toFixed(0)} m${state ? ` — ${state}` : ''}`}</title>
            </circle>
            <text x={ue.x} y={ue.y + u * 3.6} textAnchor="middle" fontSize={u * 1.8} fill="#fbbf24">UE</text>
            {serving !== null && serving !== undefined && serving >= 0 && cells[serving] && (
              <line x1={ue.x} y1={ue.y} x2={cells[serving].x_m} y2={cells[serving].y_m} stroke="#22d3ee" strokeWidth={2}
                vectorEffect="non-scaling-stroke" strokeDasharray="5 3" />
            )}
          </g>
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="font-semibold text-cyan-300">Simulation — not a live cellular network</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400 align-middle" />UE (user equipment)</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-cyan-400 align-middle" />Cell / serving coverage (solid)</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-emerald-400 align-middle" />Successful handover</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-red-400 align-middle" />Failed handover</span>
        <span>Dashed line: UE to serving cell</span>
      </figcaption>
    </figure>
  )
}
