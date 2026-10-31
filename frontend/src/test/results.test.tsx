import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ComparisonTable from '../components/ComparisonTable'
import EventsTable from '../components/EventsTable'
import { summarizeComparison } from '../pages/Results'
import type { ComparisonRow, SimEvent } from '../types'

const rows: ComparisonRow[] = [
  { metric: 'handover_count', label: 'Successful handovers', unit: 'count', baseline: 8, proposed: 2, delta: -6, relative_improvement_pct: 75, winner: 'proposed', explanation: 'Fewer handovers. (Simulated finding for this scenario and seed only.)' },
  { metric: 'failure_rate', label: 'Handover failure rate', unit: 'ratio', baseline: null, proposed: 0, delta: null, relative_improvement_pct: null, winner: 'n/a', explanation: 'Not defined.' },
  { metric: 'mean_decision_delay_s', label: 'Mean decision delay', unit: 's', baseline: 0, proposed: 1, delta: 1, relative_improvement_pct: null, winner: 'baseline', explanation: 'TTT adds delay.' },
]

describe('ComparisonTable', () => {
  it('renders metric values and winners from the data', () => {
    render(<ComparisonTable rows={rows} />)
    expect(screen.getByText('Successful handovers')).toBeInTheDocument()
    expect(screen.getByText('proposed')).toBeInTheDocument()
    expect(screen.getByText('baseline')).toBeInTheDocument()
    expect(screen.getByText('-75.0%')).toBeInTheDocument()
    expect(screen.getAllByText('n/a').length).toBeGreaterThan(0)
  })

  it('shows a hint instead of numbers when there is nothing to compare', () => {
    render(<ComparisonTable rows={[]} />)
    expect(screen.getByText(/Run both algorithms/)).toBeInTheDocument()
  })
})

describe('summarizeComparison', () => {
  it('counts winners from real rows and states the limitation', () => {
    const text = summarizeComparison(rows)
    expect(text).toContain('proposed strategy was better on 1')
    expect(text).toContain('baseline on 1')
    expect(text).toContain('1 not defined')
    expect(text).toMatch(/not real-network measurements/)
  })
})

describe('EventsTable', () => {
  it('shows an empty message', () => {
    render(<EventsTable events={[]} emptyText="Nothing yet" />)
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
  })

  it('renders success, failure and ping-pong events', () => {
    const events: SimEvent[] = [
      { id: 1, algorithm: 'baseline', type: 'handover', trigger_time_s: 14, completion_time_s: 14.5, source_cell: 0, target_cell: 1, success: true, ping_pong: false, decision_delay_s: 0, execution_delay_s: 0.5 },
      { id: 2, algorithm: 'baseline', type: 'handover', trigger_time_s: 15, completion_time_s: 15.5, source_cell: 1, target_cell: 0, success: false, failure_reason: 'target_below_threshold', ping_pong: false, decision_delay_s: 0, execution_delay_s: 0.5 },
      { id: 3, algorithm: 'baseline', type: 'handover', trigger_time_s: 20, completion_time_s: 20.5, source_cell: 0, target_cell: 1, success: true, ping_pong: true, decision_delay_s: 0, execution_delay_s: 0.5 },
    ]
    render(<EventsTable events={events} />)
    expect(screen.getByText('success')).toBeInTheDocument()
    expect(screen.getByText(/failed \(target_below_threshold\)/)).toBeInTheDocument()
    expect(screen.getByText('ping-pong')).toBeInTheDocument()
  })
})
