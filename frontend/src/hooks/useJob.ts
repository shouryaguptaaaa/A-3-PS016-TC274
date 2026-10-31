import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import type { JobSnapshot, LiveSample, SimConfig } from '../types'

const TERMINAL = ['completed', 'cancelled', 'failed']
const POLL_MS = 400
const MAX_FAILURES = 5

export interface JobState {
  snap: JobSnapshot | null
  samples: LiveSample[]
  error: string | null
  busy: boolean
  start: (config: SimConfig, stepDelayMs: number) => Promise<void>
  control: (action: 'pause' | 'resume' | 'cancel') => Promise<void>
  reset: () => void
}

/** Starts a backend job and polls its real progress; samples arrive incrementally. */
export function useJob(): JobState {
  const [snap, setSnap] = useState<JobSnapshot | null>(null)
  const [samples, setSamples] = useState<LiveSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const idRef = useRef<string | null>(null)
  const sinceRef = useRef(0)
  const failures = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const stop = useCallback(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const poll = useCallback(async () => {
    const id = idRef.current
    if (!id) return
    try {
      const s = await api.getJob(id, sinceRef.current)
      if (idRef.current !== id) return
      failures.current = 0
      setError(null)
      if (s.samples.length > 0) {
        sinceRef.current += s.samples.length
        setSamples((prev) => prev.concat(s.samples))
      }
      setSnap(s)
      if (TERMINAL.includes(s.status)) return
    } catch (e: unknown) {
      failures.current += 1
      setError(e instanceof Error ? e.message : 'Connection problem')
      if (failures.current >= MAX_FAILURES) {
        setError('Connection to the backend was lost. The run may still be going on the server; start a new run after reconnecting.')
        return
      }
    }
    timer.current = window.setTimeout(() => void poll(), POLL_MS)
  }, [])

  const reset = useCallback(() => {
    stop()
    idRef.current = null
    sinceRef.current = 0
    failures.current = 0
    setSnap(null)
    setSamples([])
    setError(null)
  }, [stop])

  const start = useCallback(
    async (config: SimConfig, stepDelayMs: number) => {
      reset()
      setBusy(true)
      try {
        const { id } = await api.startJob(config, stepDelayMs)
        idRef.current = id
        await poll()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not start the simulation')
      } finally {
        setBusy(false)
      }
    },
    [poll, reset],
  )

  const control = useCallback(
    async (action: 'pause' | 'resume' | 'cancel') => {
      const id = idRef.current
      if (!id) return
      try {
        const s = await api.jobAction(id, action)
        setSnap((prev) => (prev ? { ...prev, status: s.status } : s))
        if (action === 'resume' && timer.current === undefined) void poll()
        if (action === 'cancel') {
          stop()
          timer.current = window.setTimeout(() => void poll(), 150)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Control request failed')
      }
    },
    [poll, stop],
  )

  useEffect(() => stop, [stop])

  return { snap, samples, error, busy, start, control, reset }
}
