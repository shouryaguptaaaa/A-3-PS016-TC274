import { useState } from 'react'
import Layout from './components/Layout'
import { useHashRoute } from './hooks/useHashRoute'
import { useJob } from './hooks/useJob'
import About from './pages/About'
import Export from './pages/Export'
import History from './pages/History'
import LiveSimulation from './pages/LiveSimulation'
import Methodology from './pages/Methodology'
import NewSimulation from './pages/NewSimulation'
import Overview from './pages/Overview'
import Results from './pages/Results'
import Settings from './pages/Settings'
import Topology from './pages/Topology'
import type { AlgoName } from './types'

function toId(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

export default function App() {
  const route = useHashRoute()
  const job = useJob()
  const [algo, setAlgo] = useState<AlgoName>('proposed')

  let page
  switch (route.page) {
    case 'topology': page = <Topology job={job} algo={algo} setAlgo={setAlgo} />; break
    case 'new': page = <NewSimulation job={job} />; break
    case 'live': page = <LiveSimulation job={job} algo={algo} setAlgo={setAlgo} />; break
    case 'results': page = <Results id={toId(route.param)} compareMode={route.extra === 'compare'} />; break
    case 'history': page = <History />; break
    case 'export': page = <Export id={toId(route.param)} />; break
    case 'methodology': page = <Methodology />; break
    case 'settings': page = <Settings />; break
    case 'about': page = <About />; break
    default: page = <Overview />
  }
  return <Layout current={route.page}>{page}</Layout>
}
