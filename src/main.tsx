import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/syne'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import App from './App'
import { WorkerExportBenchmark } from './export/benchmark/WorkerExportBenchmark'
import './styles.css'

const benchmark = new URLSearchParams(window.location.search)
  .has('worker-export-benchmark')

createRoot(document.getElementById('root')!).render(
  benchmark
    ? <WorkerExportBenchmark />
    : <StrictMode><App /></StrictMode>,
)
