import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motionRegistry, getMotionDefinition } from '../motion/registry'
import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import {
  createOverlayCard,
  MIN_CARD_DURATION,
  moveCardTiming,
  parseOverlayProject,
  resizeCardTiming,
  updateCardPosition,
} from '../timeline/project'
import type {
  OverlayCard,
  OverlayPosition,
  OverlayProject,
} from '../timeline/types'
import {
  parsePersistedVideo,
  parsePersistedWorkspace,
  type PersistedVideoV1,
  type PersistedWorkspaceV1,
  type WorkspaceStorage,
} from '../persistence/workspaceStorage'
import {
  exportPngSequence,
  type ExportProgress,
} from '../export/exportController'
import {
  ExportSurface,
  type ExportSurfaceHandle,
} from '../export/ExportSurface'
import {
  supportsOverlayFileExport,
  type OverlayFileWindow,
} from '../export/fileSystemAccess'
import {
  calculateFrameCount,
} from '../export/frameMath'
import {
  createExportPerformance,
  type ExportPerformance,
  type ExportPerformanceSnapshot,
} from '../export/exportPerformance'
import {
  discardTransparentMov,
  saveTransparentMov,
} from '../export/movExportClient'
import { renderTransparentMovRaw } from '../export/rawMovClient'
import {
  canUseWorkerMovExport,
  renderTransparentMovWorker,
  supportsWorkerMovPipeline,
  WorkerMovPreparationError,
} from '../export/worker/workerMovClient'
import { ComponentRail } from './ComponentRail'
import {
  ExportPanel,
  type ExportStatus,
} from './ExportPanel'
import { ParameterPanel } from './ParameterPanel'
import { PreviewStage } from './PreviewStage'
import { TimelineEditor } from './TimelineEditor'

const createInitialParameters = () => {
  const initial = {} as Record<MotionId, ParameterValues>
  motionRegistry.forEach((definition) => {
    initial[definition.id] = { ...definition.defaults }
  })
  return initial
}

const MOTION_NAMES = Object.fromEntries(
  motionRegistry.map((definition) => [definition.id, definition.name]),
) as Record<MotionId, string>

const MOTION_DEFAULTS = Object.fromEntries(
  motionRegistry.map((definition) => [definition.id, definition.defaults]),
) as unknown as Record<MotionId, ParameterValues>

const createBrowserCardId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createUniqueCardId(cards: OverlayCard[], idFactory: () => string) {
  const requestedId = idFactory()
  if (
    requestedId.trim() !== '' &&
    !cards.some((card) => card.id === requestedId)
  ) {
    return requestedId
  }

  let fallbackId = createBrowserCardId()
  while (cards.some((card) => card.id === fallbackId)) {
    fallbackId = createBrowserCardId()
  }
  return fallbackId
}

interface VideoPreview {
  name: string
  url: string
  blob: Blob
  type: string
  lastModified: number
  restored: boolean
}

interface WorkbenchProps {
  idFactory?: () => string
  storage?: WorkspaceStorage
}

interface OverlayWorkspaceState {
  cards: OverlayCard[]
  selectedCardId: string | null
  playbackKeys: Record<string, number>
}

interface PendingMovJob {
  id: string
  fingerprint: string
}

function cloneOverlayCards(cards: OverlayCard[]) {
  return cards.map((card) => ({
    ...card,
    position: { ...card.position },
    params: { ...card.params },
  }))
}

function exportFingerprint(cards: OverlayCard[], duration: number) {
  return JSON.stringify({ duration, cards })
}

const createOverlayWorkspaceState = (): OverlayWorkspaceState => ({
  cards: [],
  selectedCardId: null,
  playbackKeys: {},
})

const createMotionPlaybackKeys = (): Record<MotionId, number> => ({
  'metric-focus': 0,
  'compare-split': 0,
  'profile-reveal': 0,
  'bar-compare': 0,
  'share-ring': 0,
  'step-flow': 0,
})

function isEditableDeleteTarget(target: EventTarget | null) {
  return (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable="true"]',
      ),
    )
  )
}

function createWorkspaceSnapshot(
  cards: OverlayCard[],
  parametersByMotion: Record<MotionId, ParameterValues>,
  activeId: MotionId,
  showSafeArea: boolean,
  video: VideoPreview | null,
): PersistedWorkspaceV1 {
  return {
    version: 1,
    project: {
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards,
    },
    parametersByMotion,
    activeId,
    showSafeArea,
    video: video
      ? {
          present: true,
          name: video.name,
          type: video.type,
          lastModified: video.lastModified,
        }
      : { present: false },
  }
}

export function Workbench({
  idFactory = createBrowserCardId,
  storage,
}: WorkbenchProps) {
  const [activeId, setActiveId] = useState<MotionId>('metric-focus')
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [parameters, setParameters] = useState(createInitialParameters)
  const [overlayWorkspace, setOverlayWorkspace] = useState(
    createOverlayWorkspaceState,
  )
  const overlayWorkspaceRef = useRef(overlayWorkspace)
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null)
  const [pendingVideo, setPendingVideo] = useState<VideoPreview | null>(null)
  const [videoError, setVideoError] = useState('')
  const [projectError, setProjectError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [isClearingWorkspace, setIsClearingWorkspace] = useState(false)
  const [hydrationStatus, setHydrationStatus] = useState<'loading' | 'ready'>(
    storage ? 'loading' : 'ready',
  )
  const videoPreviewRef = useRef<VideoPreview | null>(null)
  const pendingVideoRef = useRef<VideoPreview | null>(null)
  const skipNextAutosaveRef = useRef(Boolean(storage))
  const autosaveTimerRef = useRef<number | null>(null)
  const persistenceOperationRef = useRef<Promise<unknown>>(Promise.resolve())
  const clearingWorkspaceRef = useRef(false)
  const seekControllerRef = useRef<((time: number) => void) | null>(null)
  const exportSurfaceRef = useRef<ExportSurfaceHandle>(null)
  const exportAbortRef = useRef<AbortController | null>(null)
  const serverExportJobRef = useRef<string | null>(null)
  const pendingMovJobRef = useRef<PendingMovJob | null>(null)
  const exportOperationRef = useRef(false)
  const [exportOperationActive, setExportOperationActive] = useState(false)
  const [exportCards, setExportCards] = useState<OverlayCard[]>([])
  const [movAvailable, setMovAvailable] = useState(false)
  const [workerMovAvailable, setWorkerMovAvailable] = useState(false)
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportProgress, setExportProgress] = useState({
    completedFrames: 0,
    totalFrames: 0,
    performance: null as ExportPerformanceSnapshot | null,
  })
  const [exportMessage, setExportMessage] = useState('')
  const [playbackKeys, setPlaybackKeys] = useState(createMotionPlaybackKeys)
  const { cards, selectedCardId } = overlayWorkspace
  const queuePersistenceOperation = useCallback(
    <T,>(operation: () => Promise<T>) => {
      const nextOperation = persistenceOperationRef.current
        .catch(() => undefined)
        .then(operation)
      persistenceOperationRef.current = nextOperation
      return nextOperation
    },
    [],
  )

  const mutateOverlayWorkspace = useCallback(
    (mutation: (current: OverlayWorkspaceState) => OverlayWorkspaceState) => {
      if (clearingWorkspaceRef.current || exportOperationRef.current) {
        return overlayWorkspaceRef.current
      }
      const next = mutation(overlayWorkspaceRef.current)
      overlayWorkspaceRef.current = next
      setOverlayWorkspace(next)
      return next
    },
    [],
  )

  const activeDefinition = useMemo(() => getMotionDefinition(activeId), [activeId])
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId),
    [cards, selectedCardId],
  )
  const activeParameters = selectedCard?.params ?? parameters[activeId]
  const overlayProject = useMemo<OverlayProject>(
    () => ({
      version: 1,
      canvas: { width: 1920, height: 1080 },
      cards,
    }),
    [cards],
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/__overlay_export__/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return { mov: false, worker: false }
        const capability = (await response.json()) as {
          mov?: unknown
          rawRgba?: unknown
          transport?: unknown
          orderedRawProtocol?: unknown
          workerPipeline?: unknown
        }
        const mov = capability.mov === true
          && capability.rawRgba === true
          && capability.transport === 'websocket'
        return {
          mov,
          worker: mov && supportsWorkerMovPipeline(capability),
        }
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
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storage) {
      return
    }

    let cancelled = false

    const restoreWorkspace = async () => {
      try {
        const persisted = await storage.load()
        if (cancelled) {
          return
        }

        if (!persisted.workspace) {
          if (persisted.video) {
            throw new Error('本地工作区数据无效')
          }
          setStorageError('')
          return
        }

        const restoredWorkspace = parsePersistedWorkspace(
          persisted.workspace,
          MOTION_DEFAULTS,
        )
        let restoredVideo: VideoPreview | null = null

        if (restoredWorkspace.video.present) {
          if (!persisted.video) {
            throw new Error('本地工作区数据无效')
          }
          const video = parsePersistedVideo(persisted.video)
          restoredVideo = {
            name: video.name,
            url: URL.createObjectURL(video.blob),
            blob: video.blob,
            type: video.type,
            lastModified: video.lastModified,
            restored: true,
          }
        }

        const nextOverlayWorkspace: OverlayWorkspaceState = {
          cards: restoredWorkspace.project.cards,
          selectedCardId: null,
          playbackKeys: Object.fromEntries(
            restoredWorkspace.project.cards.map((card) => [card.id, 0]),
          ),
        }
        overlayWorkspaceRef.current = nextOverlayWorkspace
        setOverlayWorkspace(nextOverlayWorkspace)
        setParameters(restoredWorkspace.parametersByMotion)
        setActiveId(restoredWorkspace.activeId)
        setShowSafeArea(restoredWorkspace.showSafeArea)
        videoPreviewRef.current = restoredVideo
        setVideoPreview(restoredVideo)
        setVideoTime(0)
        setVideoDuration(0)
        setStorageError('')
      } catch (error) {
        if (cancelled) {
          return
        }
        setStorageError(
          error instanceof Error &&
            error.message === '本地工作区数据无效'
            ? '本地工作区数据无效'
            : '本地工作区恢复失败',
        )
      } finally {
        if (!cancelled) {
          setHydrationStatus('ready')
        }
      }
    }

    void restoreWorkspace()
    return () => {
      cancelled = true
    }
  }, [storage])

  useEffect(() => {
    if (
      !storage ||
      hydrationStatus !== 'ready' ||
      clearingWorkspaceRef.current
    ) {
      return
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      autosaveTimerRef.current = null
      if (clearingWorkspaceRef.current) {
        return
      }
      const snapshot = createWorkspaceSnapshot(
        cards,
        parameters,
        activeId,
        showSafeArea,
        videoPreview,
      )
      void queuePersistenceOperation(() => storage.saveWorkspace(snapshot))
        .then(() => setStorageError(''))
        .catch(() =>
          setStorageError('本地保存失败，刷新后可能无法恢复'),
        )
    }, 300)
    autosaveTimerRef.current = timer

    return () => {
      window.clearTimeout(timer)
      if (autosaveTimerRef.current === timer) {
        autosaveTimerRef.current = null
      }
    }
  }, [
    activeId,
    cards,
    hydrationStatus,
    parameters,
    queuePersistenceOperation,
    showSafeArea,
    storage,
    videoPreview,
  ])

  const replay = () => {
    const selectedId = overlayWorkspaceRef.current.selectedCardId
    if (selectedId) {
      mutateOverlayWorkspace((current) => ({
        ...current,
        playbackKeys: {
          ...current.playbackKeys,
          [selectedId]: (current.playbackKeys[selectedId] ?? 0) + 1,
        },
      }))
      return
    }

    setPlaybackKeys((current) => ({
      ...current,
      [activeId]: current[activeId] + 1,
    }))
  }

  const selectMotion = (id: MotionId) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    mutateOverlayWorkspace((current) => ({
      ...current,
      selectedCardId: null,
    }))
    setActiveId(id)
    setPlaybackKeys((current) => ({ ...current, [id]: current[id] + 1 }))
  }

  const updateParameter = (key: string, value: ParameterValue) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    const selectedId = overlayWorkspaceRef.current.selectedCardId
    if (selectedId) {
      mutateOverlayWorkspace((current) => ({
        ...current,
        cards: current.cards.map((card) =>
          card.id === selectedId
            ? { ...card, params: { ...card.params, [key]: value } }
            : card,
        ),
        playbackKeys: {
          ...current.playbackKeys,
          [selectedId]: (current.playbackKeys[selectedId] ?? 0) + 1,
        },
      }))
      return
    }

    setParameters((current) => ({
      ...current,
      [activeId]: { ...current[activeId], [key]: value },
    }))
    replay()
  }

  const resetParameters = () => {
    if (clearingWorkspaceRef.current) {
      return
    }
    const selectedId = overlayWorkspaceRef.current.selectedCardId
    if (selectedId) {
      mutateOverlayWorkspace((current) => ({
        ...current,
        cards: current.cards.map((card) =>
          card.id === selectedId
            ? {
                ...card,
                params: { ...getMotionDefinition(card.motionId).defaults },
              }
            : card,
        ),
        playbackKeys: {
          ...current.playbackKeys,
          [selectedId]: (current.playbackKeys[selectedId] ?? 0) + 1,
        },
      }))
      return
    }

    setParameters((current) => ({
      ...current,
      [activeId]: { ...activeDefinition.defaults },
    }))
    replay()
  }

  const selectVideo = (file: File) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    if (pendingVideoRef.current) {
      URL.revokeObjectURL(pendingVideoRef.current.url)
      pendingVideoRef.current = null
      setPendingVideo(null)
    }

    if (!file.type.startsWith('video/') || file.size === 0) {
      setVideoError('请选择有效的视频文件')
      return
    }

    const nextUrl = URL.createObjectURL(file)
    const nextVideo = {
      name: file.name,
      url: nextUrl,
      blob: file,
      type: file.type,
      lastModified: file.lastModified,
      restored: false,
    }
    pendingVideoRef.current = nextVideo
    setPendingVideo(nextVideo)
    setVideoError('')
  }

  const confirmVideo = (url: string) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    const candidate = pendingVideoRef.current
    if (!candidate || candidate.url !== url) {
      return
    }

    if (videoPreviewRef.current) {
      URL.revokeObjectURL(videoPreviewRef.current.url)
    }

    videoPreviewRef.current = candidate
    pendingVideoRef.current = null
    setVideoPreview(candidate)
    setVideoTime(0)
    setVideoDuration(0)
    setPendingVideo(null)
    setVideoError('')

    if (storage && !clearingWorkspaceRef.current) {
      const persistedVideo: PersistedVideoV1 = {
        version: 1,
        blob: candidate.blob,
        name: candidate.name,
        type: candidate.type,
        lastModified: candidate.lastModified,
      }
      const snapshot = createWorkspaceSnapshot(
        overlayWorkspaceRef.current.cards,
        parameters,
        activeId,
        showSafeArea,
        candidate,
      )
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      void queuePersistenceOperation(() =>
        storage.commitVideo(persistedVideo, snapshot),
      )
        .then(() => setStorageError(''))
        .catch(() =>
          setStorageError('本地保存失败，刷新后可能无法恢复'),
        )
    }
  }

  const rejectVideo = (url: string) => {
    const candidate = pendingVideoRef.current
    if (!candidate || candidate.url !== url) {
      return
    }

    URL.revokeObjectURL(candidate.url)
    pendingVideoRef.current = null
    setPendingVideo(null)
    setVideoError('无法读取此视频，请更换文件')
  }

  const handleActiveVideoError = (url: string) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    const activeVideo = videoPreviewRef.current
    if (!activeVideo || activeVideo.url !== url) {
      return
    }

    URL.revokeObjectURL(activeVideo.url)
    videoPreviewRef.current = null
    setVideoPreview(null)
    setVideoTime(0)
    setVideoDuration(0)
    setVideoError('视频播放失败，请更换文件')

    if (storage && !clearingWorkspaceRef.current) {
      const snapshot = createWorkspaceSnapshot(
        overlayWorkspaceRef.current.cards,
        parameters,
        activeId,
        showSafeArea,
        null,
      )
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      void queuePersistenceOperation(() => storage.removeVideo(snapshot)).catch(
        () => setStorageError('本地保存失败，刷新后可能无法恢复'),
      )
    }
  }

  const removeVideo = () => {
    if (clearingWorkspaceRef.current) {
      return
    }
    if (videoPreviewRef.current) {
      URL.revokeObjectURL(videoPreviewRef.current.url)
      videoPreviewRef.current = null
    }
    if (pendingVideoRef.current) {
      URL.revokeObjectURL(pendingVideoRef.current.url)
      pendingVideoRef.current = null
    }
    setVideoPreview(null)
    setPendingVideo(null)
    setVideoError('')
    setVideoTime(0)
    setVideoDuration(0)

    if (storage && !clearingWorkspaceRef.current) {
      const snapshot = createWorkspaceSnapshot(
        overlayWorkspaceRef.current.cards,
        parameters,
        activeId,
        showSafeArea,
        null,
      )
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      void queuePersistenceOperation(() => storage.removeVideo(snapshot))
        .then(() => setStorageError(''))
        .catch(() =>
          setStorageError('本地保存失败，刷新后可能无法恢复'),
        )
    }
  }

  const clearWorkspace = async () => {
    if (clearingWorkspaceRef.current || exportOperationRef.current) {
      return
    }
    if (
      !window.confirm(
        '确定清空工作区吗？本地视频、时间轴卡片和全部设置都会被删除。',
      )
    ) {
      return
    }

    clearingWorkspaceRef.current = true
    setIsClearingWorkspace(true)
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    try {
      if (pendingMovJobRef.current) {
        try {
          await discardTransparentMov(pendingMovJobRef.current.id)
        } catch {
          // The local export service may already have cleaned this job.
        }
        pendingMovJobRef.current = null
        serverExportJobRef.current = null
      }
      if (storage) {
        await queuePersistenceOperation(() => storage.clear())
      }
    } catch {
      clearingWorkspaceRef.current = false
      setIsClearingWorkspace(false)
      setStorageError('清空工作区失败，请稍后重试')
      return
    }

    if (videoPreviewRef.current) {
      URL.revokeObjectURL(videoPreviewRef.current.url)
    }
    if (pendingVideoRef.current) {
      URL.revokeObjectURL(pendingVideoRef.current.url)
    }

    videoPreviewRef.current = null
    pendingVideoRef.current = null
    const initialOverlayWorkspace = createOverlayWorkspaceState()
    overlayWorkspaceRef.current = initialOverlayWorkspace
    skipNextAutosaveRef.current = Boolean(storage)
    setOverlayWorkspace(initialOverlayWorkspace)
    setActiveId('metric-focus')
    setShowSafeArea(true)
    setParameters(createInitialParameters())
    setPlaybackKeys(createMotionPlaybackKeys())
    setVideoPreview(null)
    setPendingVideo(null)
    setVideoTime(0)
    setVideoDuration(0)
    setVideoError('')
    setProjectError('')
    setStorageError('')
    setExportStatus('idle')
    setExportProgress({
      completedFrames: 0,
      totalFrames: 0,
      performance: null,
    })
    setExportMessage('')
    clearingWorkspaceRef.current = false
    setIsClearingWorkspace(false)
  }

  const dropMotion = (motionId: MotionId, startTime: number) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    if (
      !Number.isFinite(videoDuration) ||
      videoDuration < MIN_CARD_DURATION
    ) {
      return
    }

    const definition = getMotionDefinition(motionId)
    mutateOverlayWorkspace((current) => {
      const zIndex =
        current.cards.reduce(
          (maximum, card) => Math.max(maximum, card.zIndex),
          -1,
        ) + 1
      const card = createOverlayCard(
        createUniqueCardId(current.cards, idFactory),
        motionId,
        startTime,
        videoDuration,
        zIndex,
        definition.defaults,
      )

      return {
        cards: [...current.cards, card],
        selectedCardId: card.id,
        playbackKeys: {
          ...current.playbackKeys,
          [card.id]: 0,
        },
      }
    })
    setActiveId(motionId)
  }

  const selectCard = (cardId: string) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    const card = overlayWorkspaceRef.current.cards.find(
      (candidate) => candidate.id === cardId,
    )
    if (!card) {
      return
    }

    mutateOverlayWorkspace((current) => ({
      ...current,
      selectedCardId: card.id,
    }))
    setActiveId(card.motionId)
  }

  const moveCard = (cardId: string, startTime: number) => {
    if (
      !Number.isFinite(videoDuration) ||
      videoDuration < MIN_CARD_DURATION
    ) {
      return
    }

    mutateOverlayWorkspace((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === cardId
          ? moveCardTiming(card, startTime, videoDuration)
          : card,
      ),
    }))
  }

  const resizeCard = (
    cardId: string,
    edge: 'start' | 'end',
    time: number,
  ) => {
    if (
      !Number.isFinite(videoDuration) ||
      videoDuration < MIN_CARD_DURATION
    ) {
      return
    }

    mutateOverlayWorkspace((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === cardId
          ? resizeCardTiming(card, edge, time, videoDuration)
          : card,
      ),
    }))
  }

  const deleteCard = useCallback((cardId: string) => {
    mutateOverlayWorkspace((current) => {
      const nextPlaybackKeys = { ...current.playbackKeys }
      delete nextPlaybackKeys[cardId]

      return {
        cards: current.cards.filter((card) => card.id !== cardId),
        selectedCardId:
          current.selectedCardId === cardId ? null : current.selectedCardId,
        playbackKeys: nextPlaybackKeys,
      }
    })
  }, [mutateOverlayWorkspace])

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      const selectedId = overlayWorkspaceRef.current.selectedCardId
      if (
        event.key !== 'Delete' ||
        !selectedId ||
        isEditableDeleteTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      deleteCard(selectedId)
    }

    document.addEventListener('keydown', handleDeleteShortcut)
    return () => document.removeEventListener('keydown', handleDeleteShortcut)
  }, [deleteCard])

  const updatePosition = (cardId: string, position: OverlayPosition) => {
    mutateOverlayWorkspace((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === cardId ? updateCardPosition(card, position) : card,
      ),
    }))
  }

  const importOverlayProject = (text: string) => {
    if (clearingWorkspaceRef.current) {
      return
    }
    let importedProject: OverlayProject

    try {
      importedProject = parseOverlayProject(text, MOTION_DEFAULTS)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'JSON 项目格式无效'
      ) {
        setProjectError('JSON 项目格式无效')
        return
      }
      throw error
    }

    mutateOverlayWorkspace(() => ({
      cards: importedProject.cards,
      selectedCardId: null,
      playbackKeys: Object.fromEntries(
        importedProject.cards.map((card) => [card.id, 0]),
      ),
    }))
    setProjectError('')
  }

  const handleMediaTimeChange = useCallback((time: number) => {
    setVideoTime(Number.isFinite(time) ? Math.max(0, time) : 0)
  }, [])

  const handleMediaDurationChange = useCallback((duration: number) => {
    setVideoDuration(Number.isFinite(duration) ? Math.max(0, duration) : 0)
  }, [])

  const handleSeekControllerReady = useCallback(
    (controller: ((time: number) => void) | null) => {
      seekControllerRef.current = controller
    },
    [],
  )

  const captureExportFrame = useCallback(async (
    time: number,
    exportPerformance: ExportPerformance,
  ) => {
    const surface = exportSurfaceRef.current
    if (!surface) throw new Error('透明导出舞台尚未准备完成')
    await exportPerformance.measure(
      'framePrepare',
      () => surface.prepareFrame(time),
    )
    return exportPerformance.measure(
      'frameCapture',
      () => surface.capturePng(),
    )
  }, [])

  const updateExportProgress = useCallback((progress: ExportProgress) => {
    setExportStatus(progress.phase)
    setExportProgress({
      completedFrames: progress.completedFrames,
      totalFrames: progress.totalFrames,
      performance: progress.performance ?? null,
    })
  }, [])

  const cancelExport = useCallback(() => {
    exportAbortRef.current?.abort()
  }, [])

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
      const exportPerformance = createExportPerformance()
      const surface = exportSurfaceRef.current
      if (!surface) throw new Error('透明导出舞台尚未准备完成')
      const result = await exportPngSequence({
        duration: videoDuration,
        captureFrame: (time) => captureExportFrame(time, exportPerformance),
        chooseDirectory: () => fileWindow.showDirectoryPicker!(),
        signal: controller.signal,
        onProgress: updateExportProgress,
        beginCapture: () => surface.beginCaptureSession(),
        endCapture: () => surface.endCaptureSession(),
        performance: exportPerformance,
      })
      setExportStatus(
        result.status === 'completed' ? 'completed' : 'cancelled',
      )
      setExportMessage(
        result.status === 'completed'
          ? `PNG 序列已保存到 ${result.outputName}`
          : `已取消，已生成的 ${result.completedFrames} 帧仍保留在目标文件夹`,
      )
    } catch (error) {
      setExportStatus('error')
      setExportMessage(
        error instanceof Error ? error.message : 'PNG 序列导出失败',
      )
    } finally {
      exportAbortRef.current = null
      exportOperationRef.current = false
      setExportOperationActive(false)
    }
  }, [captureExportFrame, cards, updateExportProgress, videoDuration])

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
    const snapshotFingerprint = exportFingerprint(
      snapshotCards,
      snapshotDuration,
    )
    setExportCards(snapshotCards)
    setExportStatus('idle')
    setExportMessage('请选择 MOV 保存位置')
    let controller: AbortController | null = null

    try {
      let fileHandle
      try {
        fileHandle = await fileWindow.showSaveFilePicker({
          suggestedName: 'Overlay-transparent.mov',
          types: [
            {
              description: '透明 QuickTime 视频',
              accept: { 'video/quicktime': ['.mov'] },
            },
          ],
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setExportStatus('cancelled')
          setExportMessage(
            pendingMovJobRef.current
              ? '已编码的 MOV 仍保留，点击导出透明 MOV 可重新保存'
              : '已取消导出',
          )
          return
        }
        setExportStatus('error')
        setExportMessage(
          error instanceof Error ? error.message : '无法选择 MOV 保存位置',
        )
        return
      }

      let pendingJob = pendingMovJobRef.current
      if (
        pendingJob &&
        pendingJob.fingerprint !== snapshotFingerprint
      ) {
        await discardTransparentMov(pendingJob.id).catch(() => undefined)
        pendingMovJobRef.current = null
        serverExportJobRef.current = null
        pendingJob = null
      }

      controller = new AbortController()
      exportAbortRef.current = controller
      const exportPerformance = createExportPerformance()
      let jobId = pendingJob?.id
      if (!jobId) {
        setExportStatus('rendering')
        setExportMessage('')
        setExportProgress({
          completedFrames: 0,
          totalFrames: calculateFrameCount(snapshotDuration),
          performance: null,
        })
        const onJobCreated = (createdJobId: string) => {
          serverExportJobRef.current = createdJobId
        }
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
            performance: exportPerformance,
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
              performance: exportPerformance,
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
        pendingMovJobRef.current = {
          id: jobId,
          fingerprint: snapshotFingerprint,
        }
      }

      setExportStatus('saving')
      setExportMessage('')
      await saveTransparentMov({
        jobId,
        fileHandle,
        signal: controller.signal,
        performance: exportPerformance,
      })
      pendingMovJobRef.current = null
      serverExportJobRef.current = null
      setExportStatus('completed')
      setExportMessage(`透明 MOV 已保存为 ${fileHandle.name}`)
    } catch (error) {
      setExportStatus(controller?.signal.aborted ? 'cancelled' : 'error')
      setExportMessage(
        pendingMovJobRef.current
          ? 'MOV 已编码完成但保存失败，点击导出透明 MOV 可重新保存'
          : error instanceof Error
            ? error.message
            : '透明 MOV 导出失败',
      )
    } finally {
      exportAbortRef.current = null
      if (!pendingMovJobRef.current) {
        serverExportJobRef.current = null
      }
      exportOperationRef.current = false
      setExportOperationActive(false)
    }
  }, [cards, updateExportProgress, videoDuration, workerMovAvailable])

  useEffect(() => {
    const pendingJob = pendingMovJobRef.current
    if (
      !pendingJob ||
      exportOperationRef.current ||
      pendingJob.fingerprint === exportFingerprint(cards, videoDuration)
    ) {
      return
    }

    pendingMovJobRef.current = null
    serverExportJobRef.current = null
    void discardTransparentMov(pendingJob.id).catch(() => undefined)
    setExportStatus('idle')
    setExportMessage('工程已修改，之前编码的 MOV 已放弃')
  }, [cards, exportOperationActive, videoDuration])

  useEffect(
    () => () => {
      exportAbortRef.current?.abort()
      const jobId = serverExportJobRef.current
      if (jobId) {
        void fetch(
          `/__overlay_export__/jobs/${encodeURIComponent(jobId)}`,
          { method: 'DELETE', keepalive: true },
        ).catch(() => undefined)
      }
      if (videoPreviewRef.current) {
        URL.revokeObjectURL(videoPreviewRef.current.url)
      }
      if (pendingVideoRef.current) {
        URL.revokeObjectURL(pendingVideoRef.current.url)
      }
    },
    [],
  )

  const fileExportSupported = supportsOverlayFileExport(
    window as unknown as OverlayFileWindow,
  )
  const canExport =
    fileExportSupported &&
    !exportOperationActive &&
    videoDuration > 0 &&
    cards.length > 0

  return (
    <div
      className="workbench"
      aria-busy={isClearingWorkspace || exportOperationActive}
    >
      <ExportSurface ref={exportSurfaceRef} cards={exportCards} />
      {hydrationStatus === 'loading' && (
        <p className="workspace-status" role="status" aria-live="polite">
          正在恢复本地工作区
        </p>
      )}
      <header className="app-header">
        <a className="brand" href="/" aria-label="动效预览台首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>
            <strong>动效预览台</strong>
            <small>动效组件实验室 / 01</small>
          </span>
        </a>
        <div className="header-status">
          <span>会话 / 本地</span>
          <span>引擎 / 浏览器</span>
          <span className="system-ready"><i /> 系统就绪</span>
        </div>
      </header>

      <div
        className="workspace"
        inert={isClearingWorkspace ? true : undefined}
      >
        <ComponentRail
          items={motionRegistry}
          activeId={activeId}
          onSelect={selectMotion}
          onAddMotion={(motionId) => dropMotion(motionId, videoTime)}
        />
        <div className="preview-workspace">
          <PreviewStage
            motionId={activeId}
            motionName={activeDefinition.name}
            params={activeParameters}
            playbackKey={playbackKeys[activeId]}
            showSafeArea={showSafeArea}
            videoUrl={videoPreview?.url}
            restoredVideo={videoPreview?.restored}
            pendingVideoUrl={pendingVideo?.url}
            onVideoReady={confirmVideo}
            onVideoError={rejectVideo}
            onActiveVideoError={handleActiveVideoError}
            overlayCards={cards}
            overlayPlaybackKeys={overlayWorkspace.playbackKeys}
            selectedCardId={selectedCardId}
            currentTime={videoTime}
            onMediaTimeChange={handleMediaTimeChange}
            onMediaDurationChange={handleMediaDurationChange}
            onSeekControllerReady={handleSeekControllerReady}
            onSelectOverlayCard={selectCard}
            onCardPositionChange={updatePosition}
          />
          <TimelineEditor
            cards={cards}
            duration={videoDuration}
            currentTime={videoTime}
            selectedCardId={selectedCardId}
            motionNames={MOTION_NAMES}
            onDropMotion={dropMotion}
            onSelectCard={selectCard}
            onMoveCard={moveCard}
            onResizeCard={resizeCard}
            onSeek={(time) => seekControllerRef.current?.(time)}
            onDeleteCard={deleteCard}
          />
        </div>
        <ParameterPanel
          controls={activeDefinition.controls}
          values={activeParameters}
          onChange={updateParameter}
          onReset={resetParameters}
          onReplay={replay}
          showSafeArea={showSafeArea}
          onToggleSafeArea={() => {
            if (!clearingWorkspaceRef.current) {
              setShowSafeArea((visible) => !visible)
            }
          }}
          videoFileName={videoPreview?.name}
          pendingVideoFileName={pendingVideo?.name}
          videoError={videoError}
          onVideoFile={selectVideo}
          onRemoveVideo={removeVideo}
          project={overlayProject}
          projectError={projectError || storageError}
          onProjectImport={importOverlayProject}
          onClearWorkspace={clearWorkspace}
          disableWorkspaceClear={exportOperationActive}
          exportControls={
            <ExportPanel
              canExport={canExport}
              movAvailable={movAvailable}
              status={exportStatus}
              completedFrames={exportProgress.completedFrames}
              totalFrames={exportProgress.totalFrames}
              performance={exportProgress.performance ?? undefined}
              message={exportMessage || undefined}
              onExportPng={() => void exportPng()}
              onExportMov={() => void exportMov()}
              onCancel={cancelExport}
            />
          }
        />
      </div>
    </div>
  )
}
