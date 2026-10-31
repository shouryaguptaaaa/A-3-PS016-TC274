import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, PlayCircle, RotateCcw, Zap } from 'lucide-react'
import {
  DEFAULT_CONFIG, FIELD_SPECS, configToForm, validateConfig, type FormValues,
} from '../lib/validation'
import type { AlgoName, SimConfig } from '../types'
import { Button } from './ui'

export interface ConfigFormProps {
  initial?: SimConfig
  busy?: boolean
  onRunBatch: (config: SimConfig) => void
  onRunLive: (config: SimConfig, stepDelayMs: number) => void
}

export default function ConfigForm({ initial = DEFAULT_CONFIG, busy = false, onRunBatch, onRunLive }: ConfigFormProps) {
  const [values, setValues] = useState<FormValues>(() => configToForm(initial))
  const [algos, setAlgos] = useState<AlgoName[]>(initial.algorithms)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [paceMs, setPaceMs] = useState('150')
  const [touched, setTouched] = useState(false)

  const { errors, config } = useMemo(() => validateConfig(values, algos), [values, algos])
  const paceNum = Number(paceMs)
  const paceError = !Number.isInteger(paceNum) || paceNum < 0 || paceNum > 2000 ? 'Whole number between 0 and 2000.' : ''

  const set = (key: string, v: string) => setValues((p) => ({ ...p, [key]: v }))
  const toggleAlgo = (a: AlgoName) =>
    setAlgos((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))

  const submit = (kind: 'batch' | 'live') => {
    setTouched(true)
    if (!config || (kind === 'live' && paceError)) return
    if (kind === 'batch') onRunBatch(config)
    else onRunLive(config, paceNum)
  }

  const err = (k: string) => (touched || values[k] !== configToForm(initial)[k] ? errors[k] : undefined)
  const shown = FIELD_SPECS.filter((f) => showAdvanced || !f.advanced)

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} aria-label="Simulation configuration" className="space-y-5">
      <div>
        <label htmlFor="scenario_name" className="block text-sm font-medium text-slate-200">Scenario name</label>
        <input id="scenario_name" value={values.scenario_name} maxLength={100}
          onChange={(e) => set('scenario_name', e.target.value)}
          aria-invalid={err('scenario_name') ? true : undefined}
          aria-describedby={err('scenario_name') ? 'scenario_name-err' : undefined}
          className="mt-1 w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm" />
        {err('scenario_name') && <p id="scenario_name-err" role="alert" className="mt-1 text-xs text-red-300">{err('scenario_name')}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="block text-sm font-medium text-slate-200">
              {f.label}{f.unit ? <span className="text-slate-400"> ({f.unit})</span> : null}
            </label>
            <input id={f.key} inputMode="decimal" value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}
              aria-invalid={err(f.key) ? true : undefined}
              aria-describedby={`${f.key}-help${err(f.key) ? ` ${f.key}-err` : ''}`}
              className={`mt-1 w-full rounded-lg border bg-navy-900 px-3 py-2 text-sm tabular-nums ${err(f.key) ? 'border-red-500' : 'border-navy-600'}`} />
            <p id={`${f.key}-help`} className="mt-1 text-xs text-slate-500">{f.help}</p>
            {err(f.key) && <p id={`${f.key}-err`} role="alert" className="mt-0.5 text-xs text-red-300">{err(f.key)}</p>}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => setShowAdvanced((s) => !s)} aria-expanded={showAdvanced}
        className="flex items-center gap-1 text-sm text-cyan-300 hover:underline">
        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showAdvanced ? 'Hide' : 'Show'} advanced model parameters
      </button>

      <fieldset>
        <legend className="text-sm font-medium text-slate-200">Algorithms to compare</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(['baseline', 'proposed'] as AlgoName[]).map((a) => (
            <label key={a} className="flex min-h-[40px] items-center gap-2 text-sm">
              <input type="checkbox" checked={algos.includes(a)} onChange={() => toggleAlgo(a)} className="h-4 w-4 accent-cyan-400" />
              {a === 'baseline' ? 'Baseline (strongest cell)' : 'Proposed (hysteresis + TTT + filtering)'}
            </label>
          ))}
        </div>
        {errors.algorithms && <p role="alert" className="mt-1 text-xs text-red-300">{errors.algorithms}</p>}
      </fieldset>

      <div className="max-w-xs">
        <label htmlFor="pace" className="block text-sm font-medium text-slate-200">Live run pace <span className="text-slate-400">(ms per step)</span></label>
        <input id="pace" inputMode="numeric" value={paceMs} onChange={(e) => setPaceMs(e.target.value)}
          aria-invalid={paceError ? true : undefined}
          className="mt-1 w-full rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm tabular-nums" />
        <p className="mt-1 text-xs text-slate-500">Only slows the live view so you can watch it; 0 = as fast as possible.</p>
        {paceError && <p role="alert" className="mt-0.5 text-xs text-red-300">{paceError}</p>}
      </div>

      {touched && Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
          Please fix the highlighted fields before running.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => submit('batch')}>
          <Zap className="h-4 w-4" aria-hidden="true" /> Run simulation
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => submit('live')}>
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Run live (watch progress)
        </Button>
        <Button variant="ghost" onClick={() => { setValues(configToForm(DEFAULT_CONFIG)); setAlgos(DEFAULT_CONFIG.algorithms); setTouched(false) }}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset defaults
        </Button>
      </div>
    </form>
  )
}
