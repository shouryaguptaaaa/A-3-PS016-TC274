import { useState } from 'react'
import ConfigForm from '../components/ConfigForm'
import { Card, ErrorBanner, PageHeader, SimNotice } from '../components/ui'
import type { JobState } from '../hooks/useJob'
import { navigate } from '../lib/route'
import { api } from '../services/api'
import type { SimConfig } from '../types'

export default function NewSimulation({ job }: { job: JobState }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runBatch = async (config: SimConfig) => {
    setBusy(true)
    setError(null)
    try {
      const exp = await api.runSimulation(config)
      navigate(`results/${exp.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setBusy(false)
    }
  }

  const runLive = async (config: SimConfig, delay: number) => {
    setError(null)
    await job.start(config, delay)
    navigate('live')
  }

  return (
    <>
      <PageHeader title="New Simulation" subtitle="Configure the scenario, then run it instantly or watch it step by step. The same seed always reproduces the same result." />
      <div className="space-y-4">
        <SimNotice />
        {error && <ErrorBanner message={error} />}
        <Card>
          <ConfigForm busy={busy || job.busy} onRunBatch={(c) => void runBatch(c)} onRunLive={(c, d) => void runLive(c, d)} />
        </Card>
      </div>
    </>
  )
}
