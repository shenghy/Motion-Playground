import { useCallback, useEffect, useRef, useState } from 'react'
import { getMotionDefinition } from '../motion/registry'
import { getActiveCards, updateCardPosition } from '../timeline/project'
import type { OverlayCard, OverlayPosition } from '../timeline/types'
import { VideoPlaybackControls } from './VideoPlaybackControls'
import type {
  MotionDefinition,
  MotionId,
  ParameterValues,
} from '../motion/types'

interface PreviewStageProps {
  motionId: MotionId
  motionName: string
  params: ParameterValues
  playbackKey: number
  showSafeArea: boolean
  videoUrl?: string
  pendingVideoUrl?: string
  onVideoReady?: (url: string) => void
  onVideoError?: (url: string) => void
  onActiveVideoError?: (url: string) => void
  overlayCards?: OverlayCard[]
  selectedCardId?: string | null
  currentTime?: number
  onMediaTimeChange?: (time: number) => void
  onMediaDurationChange?: (duration: number) => void
  onSeekControllerReady?: (seek: ((time: number) => void) | null) => void
  onSelectOverlayCard?: (id: string) => void
  onCardPositionChange?: (id: string, position: OverlayPosition) => void
  overlayPlaybackKeys?: Readonly<Record<string, number>>
}

interface PlaybackState {
  source?: string
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
}

interface PositionGesture {
  card: OverlayCard
  cardId: string
  pointerId: number
  initialClientX: number
  initialClientY: number
  initialPosition: OverlayPosition
}

const createPlaybackState = (source?: string): PlaybackState => ({
  source,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  duration: 0,
})

function renderMotion(id: MotionId, params: ParameterValues) {
  const definition = getMotionDefinition(id) as unknown as MotionDefinition
  const MotionComponent = definition.component
  return <MotionComponent params={params} />
}

function finiteMediaValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function PreviewStage({
  motionId,
  motionName,
  params,
  playbackKey,
  showSafeArea,
  videoUrl,
  pendingVideoUrl,
  onVideoReady,
  onVideoError,
  onActiveVideoError,
  overlayCards = [],
  selectedCardId = null,
  currentTime,
  onMediaTimeChange,
  onMediaDurationChange,
  onSeekControllerReady,
  onSelectOverlayCard,
  onCardPositionChange,
  overlayPlaybackKeys = {},
}: PreviewStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const positionGestureRef = useRef<PositionGesture | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    createPlaybackState(videoUrl),
  )
  const currentPlaybackState =
    playbackState.source === videoUrl
      ? playbackState
      : createPlaybackState(videoUrl)

  const updatePlaybackState = useCallback((updates: Partial<PlaybackState>) => {
    setPlaybackState((current) => ({
      ...(current.source === videoUrl
        ? current
        : createPlaybackState(videoUrl)),
      ...updates,
    }))
  }, [videoUrl])

  const reportMediaTime = useCallback((time: number) => {
    const nextTime = finiteMediaValue(time)
    updatePlaybackState({ currentTime: nextTime })
    onMediaTimeChange?.(nextTime)
  }, [onMediaTimeChange, updatePlaybackState])

  const reportMediaDuration = useCallback((duration: number) => {
    const nextDuration = finiteMediaValue(duration)
    updatePlaybackState({ duration: nextDuration })
    onMediaDurationChange?.(nextDuration)
  }, [onMediaDurationChange, updatePlaybackState])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) {
      return
    }

    if (video.paused) {
      void video
        .play()
        .catch(() => {
          if (videoRef.current === video) {
            updatePlaybackState({ isPlaying: false })
          }
        })
    } else {
      video.pause()
    }
  }

  const toggleMuted = () => {
    const video = videoRef.current
    if (!video) {
      return
    }

    video.muted = !video.muted
    updatePlaybackState({ isMuted: video.muted })
  }

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const maximum = finiteMediaValue(video.duration)
    const requestedTime = Number.isFinite(time) ? time : 0
    const nextTime = clamp(requestedTime, 0, maximum)
    video.currentTime = nextTime
    updatePlaybackState({ currentTime: nextTime })
    onMediaTimeChange?.(nextTime)
  }, [onMediaTimeChange, updatePlaybackState])

  useEffect(() => {
    if (!onSeekControllerReady) {
      return
    }

    onSeekControllerReady(seek)
    return () => onSeekControllerReady(null)
  }, [onSeekControllerReady, seek])

  const effectiveTime =
    currentTime === undefined
      ? currentPlaybackState.currentTime
      : finiteMediaValue(currentTime)
  const activeCards =
    overlayCards.length > 0
      ? getActiveCards(overlayCards, effectiveTime)
      : []

  const startPositionGesture = (
    event: React.PointerEvent<HTMLDivElement>,
    card: OverlayCard,
  ) => {
    event.stopPropagation()

    if (
      selectedCardId !== card.id ||
      (positionGestureRef.current !== null &&
        positionGestureRef.current.pointerId !== event.pointerId)
    ) {
      return
    }

    positionGestureRef.current = {
      card,
      cardId: card.id,
      pointerId: event.pointerId,
      initialClientX: event.clientX,
      initialClientY: event.clientY,
      initialPosition: card.position,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePositionMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = positionGestureRef.current
    const stage = stageRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || !stage) {
      return
    }

    const bounds = stage.getBoundingClientRect()
    if (
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      return
    }

    const nextCard = updateCardPosition(gesture.card, {
      x:
        gesture.initialPosition.x +
        ((event.clientX - gesture.initialClientX) / bounds.width) * 100,
      y:
        gesture.initialPosition.y +
        ((event.clientY - gesture.initialClientY) / bounds.height) * 100,
    })
    onCardPositionChange?.(gesture.cardId, nextCard.position)
  }

  const clearPositionGesture = (pointerId: number) => {
    if (positionGestureRef.current?.pointerId === pointerId) {
      positionGestureRef.current = null
    }
  }

  return (
    <main className="preview-stage">
      <div className="stage-heading">
        <div>
          <span className="section-index">预览舞台 / 02</span>
          <h2>{motionName}</h2>
        </div>
        <div className="stage-heading__meta">
          <span>1920 × 1080</span>
          <span>60 帧/秒</span>
          <span className="loop-status"><i /> 循环</span>
        </div>
      </div>

      <div className="stage-viewport">
        <div className="stage-ruler stage-ruler--top" aria-hidden="true">
          {Array.from({ length: 13 }, (_, index) => <i key={index} />)}
        </div>
        <div className="stage-ruler stage-ruler--left" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
        <div
          ref={stageRef}
          className="preview-canvas"
          data-testid="preview-stage"
          data-playback-key={playbackKey}
          onPointerMove={handlePositionMove}
          onPointerUp={(event) => clearPositionGesture(event.pointerId)}
          onPointerCancel={(event) => clearPositionGesture(event.pointerId)}
          onLostPointerCapture={(event) => clearPositionGesture(event.pointerId)}
        >
          {videoUrl ? (
            <video
              key={videoUrl}
              ref={videoRef}
              className="presenter-background presenter-background--video"
              data-testid="presenter-video"
              src={videoUrl}
              aria-label="本地视频背景"
              autoPlay
              muted
              loop
              playsInline
              onPlay={() => updatePlaybackState({ isPlaying: true })}
              onPause={() => updatePlaybackState({ isPlaying: false })}
              onLoadedMetadata={(event) => {
                reportMediaDuration(event.currentTarget.duration)
                reportMediaTime(event.currentTarget.currentTime)
              }}
              onTimeUpdate={(event) =>
                reportMediaTime(event.currentTarget.currentTime)
              }
              onSeeking={(event) =>
                reportMediaTime(event.currentTarget.currentTime)
              }
              onDurationChange={(event) =>
                reportMediaDuration(event.currentTarget.duration)
              }
              onVolumeChange={(event) =>
                updatePlaybackState({ isMuted: event.currentTarget.muted })
              }
              onError={() => onActiveVideoError?.(videoUrl)}
            />
          ) : (
            <img
              className="presenter-background"
              src="/reference-standing.png"
              alt="口播人物参考背景"
            />
          )}
          {pendingVideoUrl && (
            <video
              className="video-validation-probe"
              data-testid="video-validation-probe"
              src={pendingVideoUrl}
              preload="auto"
              muted
              playsInline
              aria-hidden="true"
              onCanPlay={() => onVideoReady?.(pendingVideoUrl)}
              onError={() => onVideoError?.(pendingVideoUrl)}
            />
          )}
          {overlayCards.length === 0 ? (
            <div className="motion-slot" key={`${motionId}-${playbackKey}`}>
              {renderMotion(motionId, params)}
            </div>
          ) : (
            <div className="overlay-layer">
              {activeCards.map((card) => {
                const definition = getMotionDefinition(card.motionId)
                const selected = selectedCardId === card.id
                const displayPosition = updateCardPosition(card, card.position).position

                return (
                  <div
                    key={`${card.id}-${overlayPlaybackKeys[card.id] ?? 0}`}
                    className={`overlay-card${selected ? ' overlay-card--selected' : ''}`}
                    data-testid={`overlay-card-${card.id}`}
                    data-overlay-card-id={card.id}
                    data-selected={selected ? 'true' : 'false'}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      selected
                        ? `选择叠加卡片 ${definition.name}，可用方向键微调位置`
                        : `选择叠加卡片 ${definition.name}`
                    }
                    title={
                      selected
                        ? '方向键微调 1%，按住 Shift 微调 5%'
                        : undefined
                    }
                    style={{
                      transform: `translate(${displayPosition.x}%, ${displayPosition.y}%)`,
                      zIndex: card.zIndex,
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelectOverlayCard?.(card.id)
                    }}
                    onKeyDown={(event) => {
                      if (
                        selected &&
                        (
                          event.key === 'ArrowLeft' ||
                          event.key === 'ArrowRight' ||
                          event.key === 'ArrowUp' ||
                          event.key === 'ArrowDown'
                        )
                      ) {
                        event.preventDefault()
                        event.stopPropagation()
                        const step = event.shiftKey ? 5 : 1
                        const deltaX =
                          event.key === 'ArrowLeft'
                            ? -step
                            : event.key === 'ArrowRight'
                              ? step
                              : 0
                        const deltaY =
                          event.key === 'ArrowUp'
                            ? -step
                            : event.key === 'ArrowDown'
                              ? step
                              : 0
                        const nextCard = updateCardPosition(card, {
                          x: displayPosition.x + deltaX,
                          y: displayPosition.y + deltaY,
                        })
                        onCardPositionChange?.(card.id, nextCard.position)
                        return
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        onSelectOverlayCard?.(card.id)
                      }
                    }}
                    onPointerDown={(event) => startPositionGesture(event, card)}
                  >
                    {renderMotion(card.motionId, card.params)}
                  </div>
                )
              })}
            </div>
          )}
          {videoUrl && (
            <VideoPlaybackControls
              isPlaying={currentPlaybackState.isPlaying}
              isMuted={currentPlaybackState.isMuted}
              currentTime={currentPlaybackState.currentTime}
              duration={currentPlaybackState.duration}
              onTogglePlayback={togglePlayback}
              onToggleMuted={toggleMuted}
              onSeek={seek}
            />
          )}
          {showSafeArea && (
            <>
              <div
                className="presenter-safe-area"
                data-testid="presenter-safe-area"
                aria-hidden="true"
              >
                <span>人物安全区</span>
                <i /><i /><i /><i />
              </div>
              <div
                className="subtitle-safe-area"
                data-testid="subtitle-safe-area"
                aria-hidden="true"
              >
                <span>字幕安全区 / 150像素</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="stage-footer">
        <span>色彩 / 黑白灰</span>
        <span>自动播放 · 无限循环</span>
        <span>缩放 / 适应画布</span>
      </div>
    </main>
  )
}
