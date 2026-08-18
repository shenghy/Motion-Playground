import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OverlayCard } from '../timeline/types'
import { useWorkbenchExport } from './useWorkbenchExport'

const mocks = vi.hoisted(() => ({
  disposeChime: vi.fn(async () => undefined),
  playChime: vi.fn(async () => undefined),
  renderMov: vi.fn(async () => ({
    status: 'completed' as const,
    completedFrames: 30,
    jobId: 'completed-job',
  })),
  saveMov: vi.fn(async () => undefined),
}))

vi.mock('../export/exportCompleteChime', () => ({
  createExportCompleteChime: vi.fn(() => ({
    play: mocks.playChime,
    dispose: mocks.disposeChime,
  })),
}))

vi.mock('../export/movExportClient', () => ({
  discardTransparentMov: vi.fn(async () => undefined),
  saveTransparentMov: mocks.saveMov,
}))

vi.mock('../export/worker/workerMovClient', () => ({
  canUseWorkerMovExport: vi.fn(() => true),
  renderTransparentMovWorker: mocks.renderMov,
  supportsWorkerMovPipeline: vi.fn(() => true),
  WorkerMovPreparationError: class WorkerMovPreparationError extends Error {},
}))

const card: OverlayCard = {
  id: 'completion-chime-card',
  motionId: 'metric-focus',
  start: 0,
  end: 1,
  position: { x: 0, y: 0 },
  zIndex: 1,
  params: {
    eyebrow: 'Metric',
    value: 1,
    prefix: '',
    suffix: '',
    label: 'Done',
    note: '',
    duration: 1,
  },
}

describe('useWorkbenchExport completion chime', () => {
  beforeEach(() => {
    mocks.disposeChime.mockClear()
    mocks.playChime.mockClear()
    mocks.renderMov.mockClear()
    mocks.saveMov.mockClear()
    Object.assign(window, {
      showDirectoryPicker: vi.fn(),
      showSaveFilePicker: vi.fn(async () => ({
        name: 'completed.mov',
        createWritable: vi.fn(),
      })),
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      mov: true,
      rawRgba: true,
      transport: 'websocket',
      workerPipeline: true,
    }), { headers: { 'Content-Type': 'application/json' } })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker
  })

  it('plays the chime only after the MOV file has been saved', async () => {
    const { result } = renderHook(() => useWorkbenchExport([card], 1))
    await waitFor(() => expect(result.current.workerMovAvailable).toBe(true))

    await act(async () => result.current.exportMov())

    expect(mocks.saveMov).toHaveBeenCalledTimes(1)
    expect(mocks.playChime).toHaveBeenCalledTimes(1)
    expect(mocks.saveMov.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.playChime.mock.invocationCallOrder[0])
  })

  it('does not play the chime when saving fails', async () => {
    mocks.saveMov.mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderHook(() => useWorkbenchExport([card], 1))
    await waitFor(() => expect(result.current.workerMovAvailable).toBe(true))

    await act(async () => result.current.exportMov())

    expect(mocks.playChime).not.toHaveBeenCalled()
    expect(mocks.disposeChime).toHaveBeenCalledTimes(1)
  })
})
