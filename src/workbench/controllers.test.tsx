import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useExportController } from './useExportController'
import { usePersistenceController } from './usePersistenceController'
import { useProjectController } from './useProjectController'
import { useVideoController } from './useVideoController'

describe('workbench domain controllers', () => {
  it('owns project state and supports functional workspace updates', () => {
    const { result } = renderHook(() => useProjectController())

    expect(result.current.activeId).toBe('metric-focus')
    expect(result.current.overlayWorkspace.cards).toEqual([])

    act(() => {
      result.current.setOverlayWorkspace((current) => ({
        ...current,
        selectedCardId: 'card-1',
      }))
    })

    expect(result.current.overlayWorkspace.selectedCardId).toBe('card-1')
  })

  it('keeps video, persistence, and export state in separate domains', () => {
    const video = renderHook(() => useVideoController())
    const persistence = renderHook(() => usePersistenceController(true))
    const exporting = renderHook(() => useExportController())

    expect(video.result.current.videoTime).toBe(0)
    expect(video.result.current.videoPreview).toBeNull()
    expect(persistence.result.current.hydrationStatus).toBe('loading')
    expect(exporting.result.current.exportStatus).toBe('idle')

    act(() => exporting.result.current.setExportMessage('rendering'))
    expect(exporting.result.current.exportMessage).toBe('rendering')
    expect(video.result.current.videoError).toBe('')
  })
})
