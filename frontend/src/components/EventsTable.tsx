import { ALGO_LABEL, fmtNum } from '../lib/format'
import type { SimEvent } from '../types'
import { Badge } from './ui'

export default function EventsTable({ events, emptyText = 'No events recorded.' }: { events: SimEvent[]; emptyText?: string }) {
  if (events.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>
  const sorted = [...events].sort((a, b) => (a.completion_time_s ?? a.time_s ?? 0) - (b.completion_time_s ?? b.time_s ?? 0))
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Handover and link event log</caption>
        <thead className="sticky top-0 bg-navy-800 text-xs uppercase text-slate-400">
          <tr>
            <th scope="col" className="py-2 pr-3">Algorithm</th>
            <th scope="col" className="py-2 pr-3">Event</th>
            <th scope="col" className="py-2 pr-3">Time (s)</th>
            <th scope="col" className="py-2 pr-3">Cells</th>
            <th scope="col" className="py-2 pr-3">Result</th>
            <th scope="col" className="py-2 pr-3">Decision delay</th>
            <th scope="col" className="py-2">Exec delay</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={`${e.algorithm}-${e.id}`} className="border-t border-navy-600/60">
              <td className="py-1.5 pr-3">{ALGO_LABEL[e.algorithm]}</td>
              <td className="py-1.5 pr-3">{e.type === 'handover' ? 'Handover' : e.type === 'rlf' ? 'Radio-link failure' : 'Re-establishment'}</td>
              <td className="py-1.5 pr-3 tabular-nums">
                {e.type === 'handover' ? `${fmtNum(e.trigger_time_s, 1)} → ${fmtNum(e.completion_time_s, 1)}` : fmtNum(e.time_s, 1)}
              </td>
              <td className="py-1.5 pr-3">
                {e.type === 'handover' ? `${e.source_cell} → ${e.target_cell}` : e.type === 'reestablishment' ? `cell ${e.cell}` : '—'}
              </td>
              <td className="py-1.5 pr-3">
                {e.type === 'handover' ? (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={e.success ? 'green' : 'red'}>{e.success ? 'success' : `failed (${e.failure_reason ?? ''})`}</Badge>
                    {e.ping_pong && <Badge tone="amber">ping-pong</Badge>}
                  </span>
                ) : e.type === 'rlf' ? (
                  <Badge tone="red">{(e.cause ?? '').replace(/_/g, ' ')}</Badge>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{e.type === 'handover' ? `${fmtNum(e.decision_delay_s)} s` : '—'}</td>
              <td className="py-1.5 tabular-nums">{e.type === 'handover' ? `${fmtNum(e.execution_delay_s)} s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
