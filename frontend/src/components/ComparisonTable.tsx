import { fmtMetric, fmtNum } from '../lib/format'
import type { ComparisonRow } from '../types'
import { Badge } from './ui'

export default function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">Run both algorithms in one experiment to see a paired comparison.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Baseline versus proposed algorithm comparison (lower is better for every metric)</caption>
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th scope="col" className="py-2 pr-3">Metric</th>
            <th scope="col" className="py-2 pr-3">Baseline</th>
            <th scope="col" className="py-2 pr-3">Proposed</th>
            <th scope="col" className="py-2 pr-3">Better</th>
            <th scope="col" className="py-2">Change vs baseline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-navy-600/60 align-top">
              <th scope="row" className="py-2 pr-3 font-medium text-slate-200">
                {r.label}
                <p className="mt-1 max-w-md text-xs font-normal text-slate-400">{r.explanation}</p>
              </th>
              <td className="py-2 pr-3 tabular-nums">{fmtMetric(r.unit, r.baseline)}</td>
              <td className="py-2 pr-3 tabular-nums">{fmtMetric(r.unit, r.proposed)}</td>
              <td className="py-2 pr-3">
                <Badge tone={r.winner === 'proposed' ? 'cyan' : r.winner === 'baseline' ? 'amber' : 'slate'}>
                  {r.winner === 'tie' ? 'tie' : r.winner === 'n/a' ? 'n/a' : r.winner}
                </Badge>
              </td>
              <td className="py-2 tabular-nums">
                {r.relative_improvement_pct === null
                  ? 'n/a'
                  : `${r.relative_improvement_pct >= 0 ? '' : '+'}${fmtNum(-r.relative_improvement_pct, 1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
