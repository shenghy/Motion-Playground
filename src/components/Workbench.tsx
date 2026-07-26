import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motionRegistry, getMotionDefinition } from '../motion/registry'
import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import {
  createOverlayCard,
  MIN_CARD_DURATION,
  moveCardTiming,
  resizeCardTiming,
  updateCardPosition,
} from '../timeline/project'
import type { OverlayCard, OverlayPosition } from '../timeline/types'
import { ComponentRail } from './ComponentRail'
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

const createBrowserCardId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `overlay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createUniqueCardId(cards: OverlayCard[], idFactory: () => string) {
  const requestedId = idFactory()
  if (requestedId && !cards.some((card) => card.id === requestedId)) {
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
}

interface WorkbenchProps {
  idFactory?: () => string
}

export function Workbench({ idFactory = createBrowserCardId }: WorkbenchProps) {
  const [activeId, setActiveId] = useState<MotionId>('metric-focus')
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [parameters, setParameters] = useState(createInitialParameters)
  const [cards, setCards] = useState<OverlayCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null)
  const [pendingVideo, setPendingVideo] = useState<VideoPreview | null>(null)
  const [videoError, setVideoError] = useState('')
  const videoPreviewRef = useRef<VideoPreview | null>(null)
  const pendingVideoRef = useRef<VideoPreview | null>(null)
  const seekControllerRef = useRef<((time: number) => void) | null>(null)
  const [playbackKeys, setPlaybackKeys] = useState<Record<MotionId, number>>({
    'metric-focus': 0,
    'compare-split': 0,
    'profile-reveal': 0,
    'bar-compare': 0,
    'share-ring': 0,
    'step-flow': 0,
  })

  const activeDefinition = useMemo(() => getMotionDefinition(activeId), [activeId])
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId),
    [cards, selectedCardId],
  )
  const activeParameters = selectedCard?.params ?? parameters[activeId]

  const replay = () => {
    setPlaybackKeys((current) => ({
      ...current,
      [activeId]: current[activeId] + 1,
    }))
  }

  const selectMotion = (id: MotionId) => {
    setSelectedCardId(null)
    setActiveId(id)
    setPlaybackKeys((current) => ({ ...current, [id]: current[id] + 1 }))
  }

  const updateParameter = (key: string, value: ParameterValue) => {
    if (selectedCard) {
      setCards((current) =>
        current.map((card) =>
          card.id === selectedCard.id
            ? { ...card, params: { ...card.params, [key]: value } }
            : card,
        ),
      )
      replay()
      return
    }

    setParameters((current) => ({
      ...current,
      [activeId]: { ...current[activeId], [key]: value },
    }))
    replay()
  }

  const resetParameters = () => {
    if (selectedCard) {
      setCards((current) =>
        current.map((card) =>
          card.id === selectedCard.id
            ? { ...card, params: { ...activeDefinition.defaults } }
            : card,
        ),
      )
      replay()
      return
    }

    setParameters((current) => ({
      ...current,
      [activeId]: { ...activeDefinition.defaults },
    }))
    replay()
  }

  const selectVideo = (file: File) => {
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
    const nextVideo = { name: file.name, url: nextUrl }
    pendingVideoRef.current = nextVideo
    setPendingVideo(nextVideo)
    setVideoError('')
  }

  const confirmVideo = (url: string) => {
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
  }

  const removeVideo = () => {
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
  }

  const dropMotion = (motionId: MotionId, startTime: number) => {
    if (
      !Number.isFinite(videoDuration) ||
      videoDuration < MIN_CARD_DURATION
    ) {
      return
    }

    const definition = getMotionDefinition(motionId)
    const zIndex =
      cards.reduce((maximum, card) => Math.max(maximum, card.zIndex), -1) + 1

    try {
      const card = createOverlayCard(
        createUniqueCardId(cards, idFactory),
        motionId,
        startTime,
        videoDuration,
        zIndex,
        definition.defaults,
      )
      setCards((current) => [...current, card])
      setSelectedCardId(card.id)
      setActiveId(card.motionId)
    } catch {
      // A stale or unusable media duration should not surface as a UI error.
    }
  }

  const selectCard = (cardId: string) => {
    const card = cards.find((candidate) => candidate.id === cardId)
    if (!card) {
      return
    }

    setSelectedCardId(card.id)
    setActiveId(card.motionId)
  }

  const moveCard = (cardId: string, startTime: number) => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) {
          return card
        }

        try {
          return moveCardTiming(card, startTime, videoDuration)
        } catch {
          return card
        }
      }),
    )
  }

  const resizeCard = (
    cardId: string,
    edge: 'start' | 'end',
    time: number,
  ) => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) {
          return card
        }

        try {
          return resizeCardTiming(card, edge, time, videoDuration)
        } catch {
          return card
        }
      }),
    )
  }

  const deleteCard = (cardId: string) => {
    setCards((current) => current.filter((card) => card.id !== cardId))
    if (selectedCardId === cardId) {
      setSelectedCardId(null)
    }
  }

  const updatePosition = (cardId: string, position: OverlayPosition) => {
    setCards((current) =>
      current.map((card) =>
        card.id === cardId ? updateCardPosition(card, position) : card,
      ),
    )
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
    <div className="workbench">
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

      <div className="workspace">
        <ComponentRail
          items={motionRegistry}
          activeId={activeId}
          onSelect={selectMotion}
        />
        <div className="preview-workspace">
          <PreviewStage
            motionId={activeId}
            motionName={activeDefinition.name}
            params={activeParameters}
            playbackKey={playbackKeys[activeId]}
            showSafeArea={showSafeArea}
            videoUrl={videoPreview?.url}
            pendingVideoUrl={pendingVideo?.url}
            onVideoReady={confirmVideo}
            onVideoError={rejectVideo}
            onActiveVideoError={handleActiveVideoError}
            overlayCards={selectedCard ? cards : []}
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
          onToggleSafeArea={() => setShowSafeArea((visible) => !visible)}
          videoFileName={videoPreview?.name}
          pendingVideoFileName={pendingVideo?.name}
          videoError={videoError}
          onVideoFile={selectVideo}
          onRemoveVideo={removeVideo}
        />
      </div>
    </div>
  )
}
