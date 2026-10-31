import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, FIELD_SPECS, configToForm, validateConfig } from '../lib/validation'

const ALL = ['baseline', 'proposed'] as ('baseline' | 'proposed')[]

describe('validateConfig', () => {
  it('accepts the default configuration and returns typed numbers', () => {
    const r = validateConfig(configToForm(DEFAULT_CONFIG), ALL)
    expect(r.errors).toEqual({})
    expect(r.config).toEqual(DEFAULT_CONFIG)
  })

  it('matches the specified defaults', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      scenario_name: 'Corridor mobility test', num_cells: 3, duration_s: 60, speed_kmh: 60, time_step_s: 0.5,
      noise_std_db: 2, hysteresis_db: 3, ttt_s: 1, exec_delay_s: 0.5, min_signal_dbm: -110, tx_power_dbm: -30,
      path_loss_ref_db: 38, path_loss_exponent: 3.2, seed: 42,
    })
  })

  it('validates every numeric field against its range', () => {
    for (const f of FIELD_SPECS) {
      const tooHigh = { ...configToForm(DEFAULT_CONFIG), [f.key]: String(f.max + 1) }
      expect(validateConfig(tooHigh, ALL).errors[f.key]).toBeTruthy()
      const tooLow = { ...configToForm(DEFAULT_CONFIG), [f.key]: String(f.min - 1) }
      expect(validateConfig(tooLow, ALL).errors[f.key]).toBeTruthy()
      const empty = { ...configToForm(DEFAULT_CONFIG), [f.key]: '' }
      expect(validateConfig(empty, ALL).errors[f.key]).toBe('Required.')
    }
  })

  it('rejects non-numeric input and fractional integers', () => {
    const base = configToForm(DEFAULT_CONFIG)
    expect(validateConfig({ ...base, speed_kmh: 'fast' }, ALL).errors.speed_kmh).toMatch(/valid number/)
    expect(validateConfig({ ...base, num_cells: '2.5' }, ALL).errors.num_cells).toMatch(/whole/)
    expect(validateConfig({ ...base, seed: 'Infinity' }, ALL).errors.seed).toBeTruthy()
  })

  it('requires speed to be greater than zero', () => {
    expect(validateConfig({ ...configToForm(DEFAULT_CONFIG), speed_kmh: '0' }, ALL).errors.speed_kmh).toMatch(/greater than/)
  })

  it('validates the scenario name', () => {
    const base = configToForm(DEFAULT_CONFIG)
    expect(validateConfig({ ...base, scenario_name: '   ' }, ALL).errors.scenario_name).toBeTruthy()
    expect(validateConfig({ ...base, scenario_name: '<script>' }, ALL).errors.scenario_name).toBeTruthy()
    expect(validateConfig({ ...base, scenario_name: 'x'.repeat(101) }, ALL).errors.scenario_name).toBeTruthy()
    expect(validateConfig({ ...base, scenario_name: '  Trimmed  ' }, ALL).config?.scenario_name).toBe('Trimmed')
  })

  it('requires at least one algorithm', () => {
    expect(validateConfig(configToForm(DEFAULT_CONFIG), []).errors.algorithms).toBeTruthy()
  })

  it('enforces the computational load limit across fields', () => {
    const base = { ...configToForm(DEFAULT_CONFIG), duration_s: '600', time_step_s: '0.05', num_cells: '10' }
    expect(validateConfig(base, ALL).errors.num_cells).toMatch(/exceeds/)
  })
})
