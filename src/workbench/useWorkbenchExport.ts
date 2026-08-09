import { useCallback, useEffect, useRef } from 'react'
import { exportPngSequence, type ExportProgress } from '../export/exportController'
import { createExportPerformance, type ExportPerformance } from '../export/exportPerformance'
import type { ExportSurfaceHandle } from '../export/ExportSurface'
import { supportsOverlayFileExport, type OverlayFileWindow } from '../export/fileSystemAccess'
import { calculateFrameCount } from '../export/frameMath'
import { discardTransparentMov, saveTransparentMov } from '../export/movExportClient'
import { renderTransparentMovRaw } from '../export/rawMovClient'
import {
  canUseWorkerMovExport,
  renderTransparentMovWorker,
  supportsWorkerMovPipeline,
  WorkerMovPreparationError,
} from '../export/worker/workerMovClient'
import type { OverlayCard } from '../timeline/types'
import { cloneOverlayCards, exportFingerprint } from './workbenchModel'
import { useExportController } from './useExportController'

interface PendingMovJob {
  id: string
  fingerprint: string
}

export function useWorkbenchExport(cards: OverlayCard[], videoDuration: number) {
  const exportSurfaceRef = useRef<ExportSurfaceHandle>(null)
  const exportAbortRef = useRef<AbortController | null>(null)
  const serverExportJobRef = useRef<string | null>(null)
  const pendingMovJobRef = useRef<PendingMovJob | null>(null)
  const exportOperationRef = useRef(false)
  const state = useExportController()
  const {
    exportOperationActive,
    setExportOperationActive,
    setExportCards,
    setMovAvailable,
    workerMovAvailable,
    setWorkerMovAvailable,
    setExportStatus,
    setExportProgress,
    setExportMessage,
  } = state

  useEffect(() => {
    let cancelled = false
    void fetch('/__overlay_export__/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return { mov: false, worker: false }
        const capability = await response.json() as Record<string, unknown>
        const mov = capability.mov === true
          && capability.rawRgba === true
          && capability.transport === 'websocket'
        return { mov, worker: mov && supportsWorkerMovPipeline(capability) }
      })
      .then((available) => {
        if (!cancelled) {
          setMovAvailable(available.mov)
          setWorkerMovAvailable(available.worker)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMovAvailable(false)
          setWorkerMovAvailable(false)
        }
      })
    return () => { cancelled = true }
  }, [setMovAvailable, setWorkerMovAvailable])

  const captureExportFrame = useCallback(async (
    time: number,
    performance: ExportPerformance,
  ) => {
    const surface = exportSurfaceRef.current
    if (!surface) throw new Error('透明导出舞台尚未准备完成')
    await performance.measure('framePrepare', () => surface.prepareFrame(time))
    return performance.measure('frameCapture', () => surface.capturePng())
  }, [])

  const updateExportProgress = useCallback((progress: ExportProgress) => {
    setExportStatus(progress.phase)
    setExportProgress({
      completedFrames: progress.completedFrames,
      totalFrames: progress.totalFrames,
      performance: progress.performance ?? null,
    })
  }, [setExportProgress, setExportStatus])

  const cancelExport = useCallback(() => exportAbortRef.current?.abort(), [])

  const discardPendingExport = useCallback(async () => {
    const pendingJob = pendingMovJobRef.current
    if (pendingJob) {
      try {
        await discardTransparentMov(pendingJob.id)
      } catch {
        // The local export service may already have cleaned this job.
      }
    }
    pendingMovJobRef.current = null
    serverExportJobRef.current = null
  }, [])

  const resetExportState = useCallback(() => {
    setExportStatus('idle')
    setExportProgress({
      completedFrames: 0,
      totalFrames: 0,
      performance: null,
    })
    setExportMessage('')
  }, [setExportMessage, setExportProgress, setExportStatus])

  const exportPng = useCallback(async () => {
    if (exportOperationRef.current) return
    const fileWindow = window as unknown as OverlayFileWindow
    if (!fileWindow.showDirectoryPicker) {
      setExportStatus('error')
      setExportMessage('当前浏览器不支持选择导出文件夹，请使用 Chrome 或 Edge')
      return
    }
    exportOperationRef.current = true
    setExportOperationActive(true)
    setExportCards(cloneOverlayCards(cards))
    const controller = new AbortController()
    exportAbortRef.current = controller
    setExportStatus('rendering')
    setExportMessage('')
    setExportProgress({
      completedFrames: 0,
      totalFrames: calculateFrameCount(videoDuration),
      performance: null,
    })
    try {
      const performance = createExportPerformance()
      const surface = exportSurfaceRef.current
      if (!surface) throw new Error('透明导出舞台尚未准备完成')
      const result = await exportPngSequence({
        duration: videoDuration,
        captureFrame: (time) => captureExportFrame(time, performance),
        chooseDirectory: () => fileWindow.showDirectoryPicker!(),
        signal: controller.signal,
        onProgress: updateExportProgress,
        beginCapture: () => surface.beginCaptureSession(),
        endCapture: () => surface.endCaptureSession(),
        performance,
      })
      setExportStatus(result.status === 'completed' ? 'completed' : 'cancelled')
      setExportMessage(result.status === 'completed'
        ? `PNG 序列已保存到 ${result.outputName}`
        : `已取消，已生成的 ${result.completedFrames} 帧仍保留在目标文件夹`)
    } catch (error) {
      setExportStatus('error')
      setExportMessage(error instanceof Error ? error.message : 'PNG 序列导出失败')
    } finally {
      exportAbortRef.current = null
      exportOperationRef.current = false
      setExportOperationActive(false)
    }
  }, [
    captureExportFrame, cards, setExportCards, setExportMessage,
    setExportOperationActive, setExportProgress, setExportStatus,
    updateExportProgress, videoDuration,
  ])

  const exportMov = useCallback(async () => {
    if (exportOperationRef.current) return
    const fileWindow = window as unknown as OverlayFileWindow
    if (!fileWindow.showSaveFilePicker) {
      setExportStatus('error')
      setExportMessage('当前浏览器不支持保存 MOV，请使用 Chrome 或 Edge')
      return
    }
    exportOperationRef.current = true
    setExportOperationActive(true)
    const snapshotCards = cloneOverlayCards(cards)
    const snapshotDuration = videoDuration
    const fingerprint = exportFingerprint(snapshotCards, snapshotDuration)
    setExportCards(snapshotCards)
    setExportStatus('idle')
    setExportMessage('请选择 MOV 保存位置')
    let controller: AbortController | null = null
    try {
      let fileHandle
      try {
        fileHandle = await fileWindow.showSaveFilePicker({
          suggestedName: 'Overlay-transparent.mov',
          types: [{
            description: '透明 QuickTime 视频',
            accept: { 'video/quicktime': ['.mov'] },
          }],
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setExportStatus('cancelled')
          setExportMessage(pendingMovJobRef.current
            ? '已编码的 MOV 仍保留，点击导出透明 MOV 可重新保存'
            : '已取消导出')
          return
        }
        setExportStatus('error')
        setExportMessage(error instanceof Error ? error.message : '无法选择 MOV 保存位置')
        return
      }
      let pendingJob = pendingMovJobRef.current
      if (pendingJob && pendingJob.fingerprint !== fingerprint) {
        await discardTransparentMov(pendingJob.id).catch(() => undefined)
        pendingMovJobRef.current = null
        serverExportJobRef.current = null
        pendingJob = null
      }
      controller = new AbortController()
      exportAbortRef.current = controller
      const performance = createExportPerformance()
      let jobId = pendingJob?.id
      if (!jobId) {
        setExportStatus('rendering')
        setExportMessage('')
        setExportProgress({
          completedFrames: 0,
          totalFrames: calculateFrameCount(snapshotDuration),
          performance: null,
        })
        const onJobCreated = (id: string) => { serverExportJobRef.current = id }
        const renderOnMainThread = () => {
          const surface = exportSurfaceRef.current
          if (!surface) throw new Error('透明导出舞台尚未准备完成')
          return renderTransparentMovRaw({
            duration: snapshotDuration,
            renderFrame: (time) => surface.renderRgba(time),
            signal: controller!.signal,
            onProgress: updateExportProgress,
            onJobCreated,
            beginCapture: () => surface.beginCaptureSession(),
            endCapture: () => surface.endCaptureSession(),
            performance,
          })
        }
        let result
        if (workerMovAvailable && canUseWorkerMovExport()) {
          try {
            result = await renderTransparentMovWorker({
              cards: snapshotCards,
              duration: snapshotDuration,
              signal: controller.signal,
              onProgress: updateExportProgress,
              onJobCreated,
              performance,
            })
          } catch (error) {
            if (!(error instanceof WorkerMovPreparationError)) throw error
            result = await renderOnMainThread()
          }
        } else {
          result = await renderOnMainThread()
        }
        if (result.status === 'cancelled' || !result.jobId) {
          serverExportJobRef.current = null
          setExportStatus('cancelled')
          setExportMessage(`已取消，共生成 ${result.completedFrames} 帧`)
          return
        }
        jobId = result.jobId
        pendingMovJobRef.current = { id: jobId, fingerprint }
      }
      setExportStatus('saving')
      setExportMessage('')
      await saveTransparentMov({
        jobId,
        fileHandle,
        signal: controller.signal,
        performance,
      })
      pendingMovJobRef.current = null
      serverExportJobRef.current = null
      setExportStatus('completed')
      setExportMessage(`透明 MOV 已保存为 ${fileHandle.name}`)
    } catch (error) {
      setExportStatus(controller?.signal.aborted ? 'cancelled' : 'error')
      setExportMessage(pendingMovJobRef.current
        ? 'MOV 已编码完成但保存失败，点击导出透明 MOV 可重新保存'
        : error instanceof Error ? error.message : '透明 MOV 导出失败')
    } finally {
      exportAbortRef.current = null
      if (!pendingMovJobRef.current) serverExportJobRef.current = null
      exportOperationRef.current = false
      setExportOperationActive(false)
    }
  }, [
    cards, setExportCards, setExportMessage, setExportOperationActive,
    setExportProgress, setExportStatus, updateExportProgress,
    videoDuration, workerMovAvailable,
  ])

  useEffect(() => {
    const pendingJob = pendingMovJobRef.current
    if (!pendingJob || exportOperationRef.current
      || pendingJob.fingerprint === exportFingerprint(cards, videoDuration)) return
    pendingMovJobRef.current = null
    serverExportJobRef.current = null
    void discardTransparentMov(pendingJob.id).catch(() => undefined)
    setExportStatus('idle')
    setExportMessage('工程已修改，之前编码的 MOV 已放弃')
  }, [cards, exportOperationActive, setExportMessage, setExportStatus, videoDuration])

  useEffect(() => () => {
    exportAbortRef.current?.abort()
    const jobId = serverExportJobRef.current
    if (jobId) {
      void fetch(`/__overlay_export__/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE', keepalive: true,
      }).catch(() => undefined)
    }
  }, [])

  const canExport = supportsOverlayFileExport(window as unknown as OverlayFileWindow)
    && !exportOperationActive && videoDuration > 0 && cards.length > 0

  return {
    ...state,
    exportSurfaceRef,
    exportOperationRef,
    canExport,
    exportPng,
    exportMov,
    cancelExport,
    discardPendingExport,
    resetExportState,
  }
}
