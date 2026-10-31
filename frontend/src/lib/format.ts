export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a'
  return v.toFixed(digits)
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a'
  return `${(v * 100).toFixed(digits)}%`
}

export function fmtSeconds(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a'
  return `${v.toFixed(digits)} s`
}

/** Format a metric value according to the unit sent by the backend. */
export function fmtMetric(unit: string, v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a'
  if (unit === 'ratio') return fmtPct(v)
  if (unit === 's') return fmtSeconds(v)
  if (unit === 'count') return String(Math.round(v))
  return fmtNum(v)
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const ALGO_LABEL: Record<string, string> = { baseline: 'Baseline', proposed: 'Proposed' }
export const ALGO_COLOR: Record<string, string> = { baseline: '#f59e0b', proposed: '#22d3ee' }
export const CELL_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c', '#a3e635', '#e879f9', '#2dd4bf']
