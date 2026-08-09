import { useState } from 'react'
import type { ExportPerformanceSnapshot } from '../export/exportPerformance'
import type { OverlayCard } from '../timeline/types'
import type { ExportStatus } from '../export/exportStatus'

export interface ExportProgressState {
  completedFrames: number
  totalFrames: number
  performance: ExportPerformanceSnapshot | null
}

export function useExportController() {
  const [exportOperationActive, setExportOperationActive] = useState(false)
  const [exportCards, setExportCards] = useState<OverlayCard[]>([])
  const [movAvailable, setMovAvailable] = useState(false)
  const [workerMovAvailable, setWorkerMovAvailable] = useState(false)
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportProgress, setExportProgress] = useState<ExportProgressState>({
    completedFrames: 0,
    totalFrames: 0,
    performance: null,
  })
  const [exportMessage, setExportMessage] = useState('')

  return {
    exportOperationActive,
    setExportOperationActive,
    exportCards,
    setExportCards,
    movAvailable,
    setMovAvailable,
    workerMovAvailable,
    setWorkerMovAvailable,
    exportStatus,
    setExportStatus,
    exportProgress,
    setExportProgress,
    exportMessage,
    setExportMessage,
  }
}
