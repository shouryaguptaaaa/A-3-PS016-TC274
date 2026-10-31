import { describe, expect, it } from 'vitest'
import { fmtMetric, fmtNum, fmtPct, fmtSeconds } from '../lib/format'
import { parseHash } from '../lib/route'

describe('formatters', () => {
  it('shows n/a for missing values instead of inventing numbers', () => {
    expect(fmtNum(null)).toBe('n/a')
    expect(fmtPct(undefined)).toBe('n/a')
    expect(fmtSeconds(Number.NaN)).toBe('n/a')
    expect(fmtMetric('ratio', null)).toBe('n/a')
  })

  it('formats by unit', () => {
    expect(fmtPct(0.25)).toBe('25.0%')
    expect(fmtSeconds(1.5)).toBe('1.50 s')
    expect(fmtMetric('count', 3)).toBe('3')
    expect(fmtMetric('ratio', 0.5)).toBe('50.0%')
    expect(fmtMetric('s', 2)).toBe('2.00 s')
  })
})

describe('parseHash', () => {
  it('defaults to overview', () => {
    expect(parseHash('')).toEqual({ page: 'overview', param: undefined, extra: undefined })
  })
  it('parses page, param and extra', () => {
    expect(parseHash('#/results/12/compare')).toEqual({ page: 'results', param: '12', extra: 'compare' })
  })
})
