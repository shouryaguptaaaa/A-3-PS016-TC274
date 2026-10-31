import { useState, type ReactNode } from 'react'
import {
  Activity, BarChart3, Download, FileText, History, Menu, Network, PlayCircle, Radio, Settings, Users, X,
} from 'lucide-react'
import { navigate } from '../lib/route'

export const NAV = [
  { page: 'overview', label: 'Overview', icon: Activity },
  { page: 'topology', label: 'Network Topology', icon: Network },
  { page: 'new', label: 'New Simulation', icon: PlayCircle },
  { page: 'live', label: 'Live Simulation', icon: Radio },
  { page: 'results', label: 'Results & Comparison', icon: BarChart3 },
  { page: 'history', label: 'Experiment History', icon: History },
  { page: 'export', label: 'Export Reports', icon: Download },
  { page: 'methodology', label: 'Methodology', icon: FileText },
  { page: 'settings', label: 'Settings', icon: Settings },
  { page: 'about', label: 'About the Team', icon: Users },
] as const

function NavList({ current, onPick }: { current: string; onPick: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV.map(({ page, label, icon: Icon }) => {
        const active = current === page
        return (
          <a
            key={page}
            href={`#/${page}`}
            onClick={() => {
              navigate(page)
              onPick()
            }}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition ${
              active ? 'bg-cyan-500/15 font-semibold text-cyan-300' : 'text-slate-300 hover:bg-navy-700'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </a>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="px-1">
      <p className="text-lg font-bold tracking-tight text-slate-50">
        Handover<span className="text-cyan-400">Lab</span>
      </p>
      <p className="text-[11px] leading-tight text-slate-400">PS-016 · Team Hackgen</p>
    </div>
  )
}

export default function Layout({ current, children }: { current: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-navy-600/60 bg-navy-900 p-4 lg:flex">
        <Brand />
        <NavList current={current} onPick={() => undefined} />
        <p className="mt-auto text-[11px] text-slate-500">Simulation-based research tool. Not a real-network predictor.</p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-navy-600/60 bg-navy-900/95 px-4 py-2 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-200 hover:bg-navy-700"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[57px] z-20 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-navy-600 bg-navy-900 p-3 lg:hidden">
          <NavList current={current} onPick={() => setOpen(false)} />
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-300">PS-016</span>
            <span>Simulation-Based Handover Decision Evaluation for High-Mobility Users</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
