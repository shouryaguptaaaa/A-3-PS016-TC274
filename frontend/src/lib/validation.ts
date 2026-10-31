import type { AlgoName, SimConfig } from '../types'

export const DEFAULT_CONFIG: SimConfig = {
  scenario_name: 'Corridor mobility test',
  num_cells: 3,
  duration_s: 60,
  speed_kmh: 60,
  time_step_s: 0.5,
  noise_std_db: 2,
  hysteresis_db: 3,
  ttt_s: 1,
  exec_delay_s: 0.5,
  min_signal_dbm: -110,
  tx_power_dbm: -30,
  path_loss_ref_db: 38,
  path_loss_exponent: 3.2,
  seed: 42,
  algorithms: ['baseline', 'proposed'],
  cell_spacing_m: 500,
  cell_offset_m: 30,
  reference_distance_m: 20,
  filter_alpha: 0.5,
  ping_pong_window_s: 5,
  rlf_timer_s: 1,
  reestablishment_delay_s: 1,
  baseline_hysteresis_db: 0,
}

export type NumericKey = Exclude<keyof SimConfig, 'scenario_name' | 'algorithms'>

export interface FieldSpec {
  key: NumericKey
  label: string
  unit?: string
  min: number
  max: number
  step: number
  integer?: boolean
  exclusiveMin?: boolean
  help: string
  advanced?: boolean
}

export const LIMITS = { maxSteps: 12000, maxStepCells: 60000 }

export const FIELD_SPECS: FieldSpec[] = [
  { key: 'num_cells', label: 'Number of cells', min: 2, max: 10, step: 1, integer: true, help: 'Cells placed along a straight corridor (2-10).' },
  { key: 'duration_s', label: 'Simulation duration', unit: 's', min: 5, max: 600, step: 1, help: '5-600 seconds.' },
  { key: 'speed_kmh', label: 'UE speed', unit: 'km/h', min: 0, max: 350, step: 1, exclusiveMin: true, help: 'Constant speed, above 0 up to 350 km/h.' },
  { key: 'time_step_s', label: 'Time step', unit: 's', min: 0.05, max: 5, step: 0.05, help: '0.05-5 s. Duration / step must stay within the load limit.' },
  { key: 'noise_std_db', label: 'Measurement noise (std dev)', unit: 'dB', min: 0, max: 10, step: 0.1, help: 'Gaussian noise added to every measurement.' },
  { key: 'hysteresis_db', label: 'Handover hysteresis (proposed)', unit: 'dB', min: 0, max: 15, step: 0.5, help: 'Margin the neighbour must exceed the serving cell by.' },
  { key: 'ttt_s', label: 'Time-to-trigger (proposed)', unit: 's', min: 0, max: 10, step: 0.1, help: 'How long the condition must hold continuously.' },
  { key: 'exec_delay_s', label: 'Handover execution delay', unit: 's', min: 0, max: 5, step: 0.1, help: 'Rounded up to whole time steps.' },
  { key: 'min_signal_dbm', label: 'Minimum serving signal threshold', unit: 'dBm', min: -140, max: -60, step: 1, help: 'Below this the link is unusable.' },
  { key: 'tx_power_dbm', label: 'Transmit power', unit: 'dBm', min: -60, max: 50, step: 1, help: 'Reference transmit power used by the path-loss model.' },
  { key: 'path_loss_ref_db', label: 'Path-loss reference', unit: 'dB', min: 0, max: 120, step: 0.5, help: 'Path loss at the reference distance.' },
  { key: 'path_loss_exponent', label: 'Path-loss exponent', min: 1.5, max: 6, step: 0.1, help: 'Typically 2 (free space) to 4+ (urban).' },
  { key: 'seed', label: 'Random seed', min: 0, max: 2147483647, step: 1, integer: true, help: 'Same seed = identical results.' },
  { key: 'cell_spacing_m', label: 'Cell spacing', unit: 'm', min: 100, max: 5000, step: 10, advanced: true, help: 'Distance between neighbouring cells.' },
  { key: 'cell_offset_m', label: 'Cell lateral offset', unit: 'm', min: 5, max: 500, step: 5, advanced: true, help: 'Cells sit this far from the UE path.' },
  { key: 'reference_distance_m', label: 'Reference distance', unit: 'm', min: 1, max: 100, step: 1, advanced: true, help: 'Distance at which path loss equals the reference value.' },
  { key: 'filter_alpha', label: 'Measurement filter weight (proposed)', min: 0.05, max: 1, step: 0.05, advanced: true, help: '1 = no filtering; smaller = smoother.' },
  { key: 'baseline_hysteresis_db', label: 'Baseline hysteresis', unit: 'dB', min: 0, max: 15, step: 0.5, advanced: true, help: 'Normally 0 for the plain strongest-cell rule.' },
  { key: 'ping_pong_window_s', label: 'Ping-pong window', unit: 's', min: 0.5, max: 60, step: 0.5, advanced: true, help: 'A return to the previous cell within this time is a ping-pong.' },
  { key: 'rlf_timer_s', label: 'Radio-link-failure timer', unit: 's', min: 0, max: 10, step: 0.1, advanced: true, help: 'Time below threshold before RLF is declared.' },
  { key: 'reestablishment_delay_s', label: 'Re-establishment delay', unit: 's', min: 0, max: 10, step: 0.1, advanced: true, help: 'Outage time after an RLF.' },
]

export type FormValues = Record<string, string>

export function configToForm(c: SimConfig): FormValues {
  const v: FormValues = { scenario_name: c.scenario_name }
  for (const f of FIELD_SPECS) v[f.key] = String(c[f.key])
  return v
}

export interface ValidationResult {
  errors: Record<string, string>
  config: SimConfig | null
}

const BAD_NAME = /[\u0000-\u001f\u007f<>]/

export function validateConfig(values: FormValues, algorithms: AlgoName[]): ValidationResult {
  const errors: Record<string, string> = {}
  const out: Record<string, number> = {}

  const name = (values.scenario_name ?? '').trim()
  if (!name) errors.scenario_name = 'Scenario name is required.'
  else if (name.length > 100) errors.scenario_name = 'Use at most 100 characters.'
  else if (BAD_NAME.test(name)) errors.scenario_name = "Name must not contain '<', '>' or control characters."

  for (const f of FIELD_SPECS) {
    const raw = (values[f.key] ?? '').trim()
    if (raw === '') {
      errors[f.key] = 'Required.'
      continue
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      errors[f.key] = 'Enter a valid number.'
    } else if (f.integer && !Number.isInteger(n)) {
      errors[f.key] = 'Must be a whole number.'
    } else if (f.exclusiveMin ? n <= f.min : n < f.min) {
      errors[f.key] = f.exclusiveMin ? `Must be greater than ${f.min}.` : `Must be at least ${f.min}.`
    } else if (n > f.max) {
      errors[f.key] = `Must be at most ${f.max}.`
    } else {
      out[f.key] = n
    }
  }

  if (algorithms.length === 0) errors.algorithms = 'Select at least one algorithm.'

  if (!errors.duration_s && !errors.time_step_s && !errors.num_cells) {
    const steps = Math.round(out.duration_s / out.time_step_s)
    if (steps > LIMITS.maxSteps) {
      errors.time_step_s = `Duration/step = ${steps} steps; the limit is ${LIMITS.maxSteps}.`
    } else if (steps * out.num_cells > LIMITS.maxStepCells) {
      errors.num_cells = `Steps x cells = ${steps * out.num_cells} exceeds the limit ${LIMITS.maxStepCells}. Increase the time step or reduce cells.`
    }
  }

  if (Object.keys(errors).length > 0) return { errors, config: null }
  return { errors, config: { ...(out as unknown as SimConfig), scenario_name: name, algorithms: [...algorithms] } }
}
