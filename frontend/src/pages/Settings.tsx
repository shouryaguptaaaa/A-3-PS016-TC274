import { useState } from 'react'
import { Button, Card, PageHeader } from '../components/ui'
import { api, getApiBase, setApiBase } from '../services/api'

export default function Settings() {
  const [url, setUrl] = useState(getApiBase())
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const save = () => {
    setApiBase(url)
    setStatus({ ok: true, text: `Saved. Using ${getApiBase()}` })
  }
  const test = async () => {
    setApiBase(url)
    try {
      const h = await api.health()
      setStatus({ ok: h.status === 'ok', text: `Backend reachable (status: ${h.status}).` })
    } catch (e: unknown) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'Backend not reachable.' })
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Connection settings for the HandoverLab backend." />
      <Card title="Backend API URL">
        <label htmlFor="api-url" className="block text-sm font-medium">API base URL</label>
        <input id="api-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/api" className="mt-1 w-full max-w-lg rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm" />
        <p className="mt-1 text-xs text-slate-500">Default <code>/api</code> uses the Vite dev proxy (or the nginx proxy in Docker). Example for a separate backend: <code>http://localhost:8000/api</code> (add that origin to CORS_ORIGINS in the backend).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={save}>Save</Button>
          <Button variant="secondary" onClick={() => void test()}>Test connection</Button>
          <Button variant="ghost" onClick={() => { setUrl('/api'); setApiBase(''); setStatus({ ok: true, text: 'Reset to /api' }) }}>Reset</Button>
        </div>
        {status && <p role="status" className={`mt-3 text-sm ${status.ok ? 'text-emerald-300' : 'text-red-300'}`}>{status.text}</p>}
      </Card>
    </>
  )
}
