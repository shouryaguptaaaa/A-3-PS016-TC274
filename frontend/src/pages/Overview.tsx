import { PlayCircle } from 'lucide-react'
import { CompareBars } from '../components/Charts'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, SimNotice, Spinner, StatCard } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { ALGO_LABEL, fmtDate, fmtNum, fmtPct, fmtSeconds } from '../lib/format'
import { navigate } from '../lib/route'
import { api } from '../services/api'
import type { AlgoName } from '../types'

export default function Overview() {
  const { data, error, loading, reload } = useAsync(() => api.overview(), [])

  return (
    <>
      <PageHeader title="HandoverLab — Overview" subtitle="Evaluate and compare handover decision strategies for users moving between wireless cells at different speeds. Metrics below are computed from your saved simulation runs.">
        <Button onClick={() => navigate('new')}><PlayCircle className="h-4 w-4" aria-hidden="true" /> New experiment</Button>
      </PageHeader>
      <div className="space-y-5">
        <SimNotice />
        {loading && <Spinner />}
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {data && data.total_experiments === 0 && (
          <EmptyState title="No experiments yet" text="Run your first simulation to see handover counts, failure rates and algorithm comparisons here. Nothing is shown until real results exist."
            action={<Button onClick={() => navigate('new')}>Configure a simulation</Button>} />
        )}
        {data && data.total_experiments > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="Total experiments" value={String(data.total_experiments)} />
              <StatCard label="Simulated handover events" value={String(data.total_handover_events)} hint="Completed attempts, all algorithms" />
              <StatCard label="Avg handover delay" value={fmtSeconds(data.avg_handover_delay_s)} hint="Decision + execution delay per attempt" />
              <StatCard label="Handover failure rate" value={fmtPct(data.failure_rate)} hint="Failed / attempts" />
              <StatCard label="Ping-pong rate" value={fmtPct(data.ping_pong_rate)} hint="Ping-pong / successful handovers" />
              <StatCard label="Avg handover count" value={fmtNum(data.avg_handover_count, 1)} hint="Successful handovers per run" />
            </div>

            <Card title="Algorithm performance comparison" subtitle="Aggregated over all saved experiments (each algorithm over the runs where it was included).">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th scope="col" className="py-2 pr-3">Algorithm</th><th scope="col" className="py-2 pr-3">Runs</th>
                      <th scope="col" className="py-2 pr-3">Avg handovers</th><th scope="col" className="py-2 pr-3">Failure rate</th>
                      <th scope="col" className="py-2 pr-3">Ping-pong rate</th><th scope="col" className="py-2 pr-3">Avg outage</th>
                      <th scope="col" className="py-2">Avg delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(data.by_algorithm) as AlgoName[]).map((a) => {
                      const m = data.by_algorithm[a]
                      if (!m) return null
                      return (
                        <tr key={a} className="border-t border-navy-600/60">
                          <th scope="row" className="py-2 pr-3 font-medium">{ALGO_LABEL[a]}</th>
                          <td className="pr-3 tabular-nums">{m.runs}</td>
                          <td className="pr-3 tabular-nums">{fmtNum(m.avg_handover_count, 1)}</td>
                          <td className="pr-3 tabular-nums">{fmtPct(m.failure_rate)}</td>
                          <td className="pr-3 tabular-nums">{fmtPct(m.ping_pong_rate)}</td>
                          <td className="pr-3 tabular-nums">{fmtSeconds(m.avg_outage_s)}</td>
                          <td className="tabular-nums">{fmtSeconds(m.avg_total_delay_s)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {data.by_algorithm.baseline && data.by_algorithm.proposed && (
                <div className="mt-4">
                  <h3 className="mb-1 text-sm font-medium text-slate-300">Average successful handovers per run</h3>
                  <CompareBars yLabel="Handovers" data={[{ name: 'All experiments', baseline: data.by_algorithm.baseline.avg_handover_count, proposed: data.by_algorithm.proposed.avg_handover_count }]} />
                </div>
              )}
            </Card>

            <Card title="Recent experiments" actions={<Button variant="ghost" onClick={() => navigate('history')}>View all</Button>}>
              <ul className="divide-y divide-navy-600/60">
                {data.recent.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><span className="text-slate-400">#{e.id}</span> {e.scenario_name} <span className="text-xs text-slate-500">· {e.speed_kmh} km/h · {e.num_cells} cells · {fmtDate(e.created_at)}</span></span>
                    <Button variant="secondary" onClick={() => navigate(`results/${e.id}`)}>Open results</Button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
