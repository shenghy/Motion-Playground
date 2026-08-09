import { useCallback, useEffect, useMemo, useRef } from 'react'
import { motionRegistry, getMotionDefinition } from '../motion/registry'
import type { MotionId, ParameterValue } from '../motion/types'
import {
  createOverlayCard,
  MIN_CARD_DURATION,
  moveCardTiming,
  parseOverlayProject,
  resizeCardTiming,
  updateCardPosition,
} from '../timeline/project'
import type {
  OverlayPosition,
  OverlayProject,
} from '../timeline/types'
import {
  parsePersistedVideo,
  parsePersistedWorkspace,
  type PersistedVideoV1,
  type WorkspaceStorage,
} from '../persistence/workspaceStorage'
import { ExportSurface } from '../export/ExportSurface'
import { ComponentRail } from './ComponentRail'
import { ExportPanel } from './ExportPanel'
import { ParameterPanel } from './ParameterPanel'
import { PreviewStage } from './PreviewStage'
import { TimelineEditor } from './TimelineEditor'
import {
  createInitialParameters,
  createMotionPlaybackKeys,
  createOverlayWorkspaceState,
  useProjectController,
  type OverlayWorkspaceState,
} from '../workbench/useProjectController'
import { useVideoController, type VideoPreview } from '../workbench/useVideoController'
import { usePersistenceController } from '../workbench/usePersistenceController'
import { useWorkbenchExport } from '../workbench/useWorkbenchExport'
import {
  createBrowserCardId,
  createUniqueCardId,
  createWorkspaceSnapshot,
  isEditableDeleteTarget,
  MOTION_COLORS,
  MOTION_DEFAULTS,
  MOTION_NAMES,
} from '../workbench/workbenchModel'

interface WorkbenchProps {
  idFactory?: () => string
  storage?: WorkspaceStorage
}

export function Workbench({
  idFactory = createBrowserCardId,
  storage,
}: WorkbenchProps) {
  const {
    activeId,
    setActiveId,
    showSafeArea,
    setShowSafeArea,
    parameters,
    setParameters,
    overlayWorkspace,
    setOverlayWorkspace,
    projectError,
    setProjectError,
    playbackKeys,
    setPlaybackKeys,
  } = useProjectController()
  const overlayWorkspaceRef = useRef(overlayWorkspace)
  const {
    videoTime,
    setVideoTime,
    videoDuration,
    setVideoDuration,
    videoPreview,
    setVideoPreview,
    pendingVideo,
    setPendingVideo,
    videoError,
    setVideoError,
  } = useVideoController()
  const {
    storageError,
    setStorageError,
    isClearingWorkspace,
    setIsClearingWorkspace,
    hydrationStatus,
    setHydrationStatus,
  } = usePersistenceController(Boolean(storage))
  const videoPreviewRef = useRef<VideoPreview | null>(null)
  const pendingVideoRef = useRef<VideoPreview | null>(null)
  const skipNextAutosaveRef = useRef(Boolean(storage))
  const autosaveTimerRef = useRef<number | null>(null)
  const persistenceOperationRef = useRef<Promise<unknown>>(Promise.resolve())
  const clearingWorkspaceRef = useRef(false)
  const seekControllerRef = useRef<((time: number) => void) | null>(null)
  const { cards, selectedCardId } = overlayWorkspace
  const {
    exportOperationActive,
    exportCards,
    movAvailable,
    exportStatus,
    exportProgress,
    exportMessage,
    exportSurfaceRef,
    exportOperationRef,
    canExport,
    exportPng,
    exportMov,
    cancelExport,
    discardPendingExport,
    resetExportState,
  } = useWorkbenchExport(cards, videoDuration)
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
    [exportOperationRef, setOverlayWorkspace],
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
  }, [
    setActiveId,
    setHydrationStatus,
    setOverlayWorkspace,
    setParameters,
    setShowSafeArea,
    setStorageError,
    setVideoDuration,
    setVideoPreview,
    setVideoTime,
    storage,
  ])

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
    setStorageError,
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
      await discardPendingExport()
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
    resetExportState()
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
  }, [setVideoTime])

  const handleMediaDurationChange = useCallback((duration: number) => {
    setVideoDuration(Number.isFinite(duration) ? Math.max(0, duration) : 0)
  }, [setVideoDuration])

  const handleSeekControllerReady = useCallback(
    (controller: ((time: number) => void) | null) => {
      seekControllerRef.current = controller
    },
    [],
  )

  useEffect(
    () => () => {
      if (videoPreviewRef.current) {
        URL.revokeObjectURL(videoPreviewRef.current.url)
      }
      if (pendingVideoRef.current) {
        URL.revokeObjectURL(pendingVideoRef.current.url)
      }
    },
    [],
  )

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
            motionColors={MOTION_COLORS}
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
