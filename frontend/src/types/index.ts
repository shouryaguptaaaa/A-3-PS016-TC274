export type AlgoName = 'baseline' | 'proposed'

export interface SimConfig {
  scenario_name: string
  num_cells: number
  duration_s: number
  speed_kmh: number
  time_step_s: number
  noise_std_db: number
  hysteresis_db: number
  ttt_s: number
  exec_delay_s: number
  min_signal_dbm: number
  tx_power_dbm: number
  path_loss_ref_db: number
  path_loss_exponent: number
  seed: number
  algorithms: AlgoName[]
  cell_spacing_m: number
  cell_offset_m: number
  reference_distance_m: number
  filter_alpha: number
  ping_pong_window_s: number
  rlf_timer_s: number
  reestablishment_delay_s: number
  baseline_hysteresis_db: number
}

export interface DelayStats {
  n: number
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  std: number | null
}

export interface Metrics {
  handover_attempts: number
  handover_count: number
  handover_failures: number
  failure_rate: number | null
  ping_pong_events: number
  ping_pong_rate: number | null
  outage_duration_s: number
  outage_ratio: number | null
  interruption_s: number
  rlf_count: number
  handovers_per_minute: number | null
  mean_serving_rsrp_dbm: number | null
  execution_delay_s: DelayStats
  decision_delay_s: DelayStats
  total_delay_s: DelayStats
  mean_decision_delay_s: number | null
}

export interface SimEvent {
  id: number
  algorithm: AlgoName
  type: 'handover' | 'rlf' | 'reestablishment'
  trigger_time_s?: number
  completion_time_s?: number
  source_cell?: number
  target_cell?: number
  success?: boolean
  failure_reason?: string | null
  ping_pong?: boolean
  decision_delay_s?: number
  execution_delay_s?: number
  source_rsrp_dbm?: number
  target_rsrp_dbm?: number
  time_s?: number
  cause?: string
  cell?: number
}

export interface AlgoResult {
  algorithm: AlgoName
  serving_cell: number[]
  state: string[]
  events: SimEvent[]
  metrics: Metrics
}

export type Winner = 'baseline' | 'proposed' | 'tie' | 'n/a'

export interface ComparisonRow {
  metric: string
  label: string
  unit: string
  baseline: number | null
  proposed: number | null
  delta: number | null
  relative_improvement_pct: number | null
  winner: Winner
  explanation: string
}

export interface CellInfo {
  id: number
  x_m: number
  y_m: number
}

export interface SimResult {
  metadata: {
    engine_version: string
    seed: number
    steps: number
    time_step_s: number
    duration_s: number
    num_cells: number
    coverage_radius_m: number
    cells: CellInfo[]
    assumptions: string[]
    simulated: boolean
    disclaimer: string
  }
  trajectory: { time_s: number[]; x_m: number[]; y_m: number[] }
  signal: { true_dbm: number[][]; measured_dbm: number[][] }
  algorithms: Partial<Record<AlgoName, AlgoResult>>
  comparison: ComparisonRow[]
}

export interface ExperimentSummary {
  id: number
  scenario_name: string
  created_at: string
  status: string
  speed_kmh: number
  num_cells: number
  duration_s: number
  seed: number
  algorithms: AlgoName[]
  metrics: Partial<Record<AlgoName, Metrics>>
}

export interface ExperimentDetail extends ExperimentSummary {
  config: SimConfig
  result: SimResult
}

export interface ExperimentList {
  total: number
  items: ExperimentSummary[]
}

export interface AlgoOverview {
  runs: number
  handover_attempts: number
  handover_count: number
  avg_handover_count: number
  failure_rate: number | null
  ping_pong_rate: number | null
  avg_outage_s: number
  avg_interruption_s: number
  avg_total_delay_s: number | null
}

export interface Overview {
  total_experiments: number
  total_handover_events: number
  avg_handover_delay_s: number | null
  failure_rate: number | null
  ping_pong_rate: number | null
  avg_handover_count: number | null
  by_algorithm: Partial<Record<AlgoName, AlgoOverview>>
  recent: ExperimentSummary[]
}

export interface LiveSample {
  k: number
  t: number
  x: number
  y: number
  true: number[]
  meas: number[]
  algos: Record<string, { serving: number; state: string }>
  new_events: SimEvent[]
}

export type JobStatus = 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

export interface JobSnapshot {
  id: string
  status: JobStatus
  scenario_name: string
  progress: { step: number; total_steps: number; fraction: number }
  samples: LiveSample[]
  events: SimEvent[]
  experiment_id: number | null
  error: string | null
  cells: CellInfo[]
  coverage_radius_m: number
  algorithms: AlgoName[]
  min_signal_dbm: number
}
