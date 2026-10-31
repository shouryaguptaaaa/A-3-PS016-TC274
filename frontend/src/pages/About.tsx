import { Card, PageHeader } from '../components/ui'

const ROWS: Array<[string, string]> = [
  ['Project', 'HandoverLab'],
  ['Problem Statement', 'PS-016'],
  ['Title', 'Simulation-Based Handover Decision Evaluation for High-Mobility Users'],
  ['Team', 'Hackgen'],
  ['Team Leader', 'Vaidik Upadhyay'],
  ['Developer and Team Member', 'Shourya Maheshwari'],
  ['Mentor', 'Abhay Gupta'],
  ['Team ID', 'A3-PS016-TC274'],
]

export default function About() {
  return (
    <>
      <PageHeader title="About the Team" subtitle="AIORI-3 Hackathon · Problem Statement PS-016" />
      <Card>
        <dl className="divide-y divide-navy-600/60">
          {ROWS.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-3">
              <dt className="text-sm text-slate-400">{k}</dt>
              <dd className="text-sm font-medium text-slate-100 sm:col-span-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  )
}
