import type {
  ExperimentDetail, ExperimentList, ExperimentSummary, JobSnapshot, Overview, SimConfig,
} from '../types'

const KEY = 'handoverlab.apiBase'

export function getApiBase(): string {
  try {
    return localStorage.getItem(KEY) || '/api'
  } catch {
    return '/api'
  }
}

export function setApiBase(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY, value.trim().replace(/\/+$/, ''))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface ValidationItem { loc?: Array<string | number>; msg?: string }

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string | ValidationItem[] }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((d) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? 'invalid'}`).join('; ')
    }
  } catch {
    /* not JSON */
  }
  return res.statusText || `HTTP ${res.status}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(getApiBase() + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError('Cannot reach the backend. Check that it is running and the API URL in Settings is correct.', 0)
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  overview: () => request<Overview>('/stats/overview'),
  runSimulation: (config: SimConfig) =>
    request<ExperimentDetail>('/simulations', { method: 'POST', body: JSON.stringify(config) }),
  listSimulations: (search: string, limit: number, offset: number) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search.trim()) q.set('search', search.trim())
    return request<ExperimentList>(`/simulations?${q.toString()}`)
  },
  getSimulation: (id: number) => request<ExperimentDetail>(`/simulations/${id}`),
  deleteSimulation: (id: number) => request<void>(`/simulations/${id}`, { method: 'DELETE' }),
  compare: (ids: number[]) =>
    request<{ experiments: ExperimentSummary[] }>('/simulations/compare', {
      method: 'POST',
      body: JSON.stringify({ experiment_ids: ids }),
    }),
  startJob: (config: SimConfig, stepDelayMs: number) =>
    request<{ id: string; status: string }>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ config, step_delay_ms: stepDelayMs }),
    }),
  getJob: (id: string, since: number) => request<JobSnapshot>(`/jobs/${id}?since=${since}`),
  jobAction: (id: string, action: 'pause' | 'resume' | 'cancel') =>
    request<JobSnapshot>(`/jobs/${id}/${action}`, { method: 'POST' }),
}

/** Download a backend file through fetch so the configurable API base is honoured. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(getApiBase() + path)
  } catch {
    throw new ApiError('Cannot reach the backend.', 0)
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
