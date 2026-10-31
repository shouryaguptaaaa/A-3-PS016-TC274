import { Card, PageHeader } from '../components/ui'

const METRICS: Array<[string, string]> = [
  ['Successful handovers', 'Serving-cell changes caused by completed, successful handovers.'],
  ['Handover failure rate', 'failed attempts ÷ completed attempts (n/a with zero attempts).'],
  ['Ping-pong rate', 'successful A→B→A returns within the ping-pong window ÷ successful handovers (n/a with zero).'],
  ['Outage duration (s)', 'Time with no usable serving link: signal below the minimum threshold until recovery, plus re-establishment time.'],
  ['Handover interruption (s)', 'Total time spent executing handovers.'],
  ['Decision / execution delay (s)', 'Decision: from the trigger condition first holding to execution start. Execution: configured delay rounded up to whole time steps.'],
]

export default function Methodology() {
  return (
    <>
      <PageHeader title="Methodology" subtitle="How HandoverLab models, simulates and evaluates handover decisions." />
      <div className="space-y-4">
        <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          HandoverLab is a simplified simulation model. It is not a validated real-world radio-network predictor, and it makes no claim of 6G compliance, telecom certification, real-network integration or proven superiority.
        </p>
        <Card title="1. The handover problem for high-mobility users">
          <p className="text-sm text-slate-300">A moving user must switch serving cells before the current link becomes unusable. Switch too early or too often and signalling load and ping-pong grow; switch too late and the link drops. Faster users cross cell edges more quickly, leaving less time to decide and execute.</p>
        </Card>
        <Card title="2. Signal and path-loss assumptions">
          <p className="text-sm text-slate-300">Cells lie on a line with a lateral offset; the UE moves along a straight corridor at constant speed. Received power is RSRP = P<sub>tx</sub> − PL(d) with log-distance path loss PL(d) = PL<sub>ref</sub> + 10·n·log<sub>10</sub>(max(d, d<sub>0</sub>)/d<sub>0</sub>), where d<sub>0</sub> is the reference distance. Measurements add independent zero-mean Gaussian noise. No shadowing, fast fading, interference or load is modelled.</p>
        </Card>
        <Card title="3. Baseline algorithm">
          <p className="text-sm text-slate-300">Strongest-cell rule: hand over immediately when the best neighbour’s measured RSRP exceeds the serving cell’s measured RSRP (optionally by a baseline hysteresis, default 0 dB). No time-to-trigger and no filtering.</p>
        </Card>
        <Card title="4. Proposed algorithm (a candidate, not a proven improvement)">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>Filter measurements: F[k] = α·M[k] + (1−α)·F[k−1].</li>
            <li>Entering condition: best neighbour F &gt; serving F + hysteresis.</li>
            <li>The condition for the same neighbour must hold continuously for the time-to-trigger (TTT); otherwise the timer restarts.</li>
            <li>Urgent bypass: if the serving cell’s filtered RSRP is below the minimum threshold, TTT is skipped.</li>
          </ol>
          <p className="mt-2 text-sm text-slate-300">Hysteresis and TTT trade fewer unnecessary handovers against later switching; whether that helps is decided by the experiments, not assumed.</p>
        </Card>
        <Card title="5. Handover outcome and link failure rules">
          <p className="text-sm text-slate-300">A handover succeeds only if (a) the true source RSRP at execution start and (b) the true target RSRP at execution completion are both at or above the minimum threshold. A failure causes a radio-link failure and re-establishment (outage, then re-selection of the strongest measured cell). A radio-link failure is also declared when the serving RSRP stays below the threshold for the RLF timer.</p>
        </Card>
        <Card title="6. Evaluation metrics">
          <dl className="space-y-2 text-sm">{METRICS.map(([k, v]) => <div key={k}><dt className="font-medium text-slate-200">{k}</dt><dd className="text-slate-400">{v}</dd></div>)}</dl>
        </Card>
        <Card title="7. Experimental procedure and reproducibility">
          <p className="text-sm text-slate-300">Both algorithms run in lock-step on the same trajectory and the same pre-generated noise matrix (paired comparison). The random seed fully determines the noise, so identical settings reproduce identical results. Results are stored with their configuration and can be exported as CSV, JSON or PDF.</p>
        </Card>
        <Card title="8. Limitations">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Single straight corridor, constant speed, regular cell spacing.</li>
            <li>No shadowing, fading, interference, load, antenna patterns or protocol signalling detail.</li>
            <li>Deterministic threshold rules for success/failure; time quantised to the chosen time step.</li>
            <li>One seed is one sample; repeat with several seeds before drawing conclusions.</li>
            <li>Findings describe the simulated scenario only.</li>
          </ul>
        </Card>
      </div>
    </>
  )
}
