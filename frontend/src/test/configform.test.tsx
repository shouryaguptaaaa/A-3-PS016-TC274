import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfigForm from '../components/ConfigForm'
import { DEFAULT_CONFIG } from '../lib/validation'

describe('ConfigForm', () => {
  it('shows the specified default values', () => {
    render(<ConfigForm onRunBatch={vi.fn()} onRunLive={vi.fn()} />)
    expect(screen.getByLabelText('Scenario name')).toHaveValue('Corridor mobility test')
    expect(screen.getByLabelText(/Number of cells/)).toHaveValue('3')
    expect(screen.getByLabelText(/UE speed/)).toHaveValue('60')
    expect(screen.getByLabelText(/Random seed/)).toHaveValue('42')
  })

  it('submits the validated configuration', () => {
    const onRunBatch = vi.fn()
    render(<ConfigForm onRunBatch={onRunBatch} onRunLive={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/UE speed/), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: /Run simulation/ }))
    expect(onRunBatch).toHaveBeenCalledTimes(1)
    expect(onRunBatch.mock.calls[0][0]).toEqual({ ...DEFAULT_CONFIG, speed_kmh: 120 })
  })

  it('blocks submission and shows an accessible error for invalid input', () => {
    const onRunBatch = vi.fn()
    render(<ConfigForm onRunBatch={onRunBatch} onRunLive={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Number of cells/), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: /Run simulation/ }))
    expect(onRunBatch).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Number of cells/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('requires at least one algorithm', () => {
    const onRunBatch = vi.fn()
    render(<ConfigForm onRunBatch={onRunBatch} onRunLive={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/Baseline/))
    fireEvent.click(screen.getByLabelText(/Proposed/))
    fireEvent.click(screen.getByRole('button', { name: /Run simulation/ }))
    expect(onRunBatch).not.toHaveBeenCalled()
    expect(screen.getByText('Select at least one algorithm.')).toBeInTheDocument()
  })

  it('starts a live run with the chosen pace', () => {
    const onRunLive = vi.fn()
    render(<ConfigForm onRunBatch={vi.fn()} onRunLive={onRunLive} />)
    fireEvent.change(screen.getByLabelText(/Live run pace/), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /Run live/ }))
    expect(onRunLive).toHaveBeenCalledWith(DEFAULT_CONFIG, 50)
  })

  it('reveals advanced parameters on demand', () => {
    render(<ConfigForm onRunBatch={vi.fn()} onRunLive={vi.fn()} />)
    expect(screen.queryByLabelText(/Cell spacing/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/advanced model parameters/))
    expect(screen.getByLabelText(/Cell spacing/)).toBeInTheDocument()
  })
})
