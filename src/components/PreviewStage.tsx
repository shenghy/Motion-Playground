import { useRef, useState } from 'react'
import { BarCompare } from '../motion/BarCompare'
import { CompareSplit } from '../motion/CompareSplit'
import { MetricFocus } from '../motion/MetricFocus'
import { ProfileReveal } from '../motion/ProfileReveal'
import { ShareRing } from '../motion/ShareRing'
import { StepFlow } from '../motion/StepFlow'
import { VideoPlaybackControls } from './VideoPlaybackControls'
import type {
  BarCompareParams,
  CompareSplitParams,
  MetricFocusParams,
  MotionId,
  ParameterValues,
  ProfileRevealParams,
  ShareRingParams,
  StepFlowParams,
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
}

interface PlaybackState {
  source?: string
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
}

const createPlaybackState = (source?: string): PlaybackState => ({
  source,
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  duration: 0,
})

function renderMotion(id: MotionId, params: ParameterValues) {
  switch (id) {
    case 'compare-split':
      return <CompareSplit params={params as CompareSplitParams} />
    case 'profile-reveal':
      return <ProfileReveal params={params as ProfileRevealParams} />
    case 'bar-compare':
      return <BarCompare params={params as BarCompareParams} />
    case 'share-ring':
      return <ShareRing params={params as ShareRingParams} />
    case 'step-flow':
      return <StepFlow params={params as StepFlowParams} />
    default:
      return <MetricFocus params={params as MetricFocusParams} />
  }
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
}: PreviewStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    createPlaybackState(videoUrl),
  )
  const currentPlaybackState =
    playbackState.source === videoUrl
      ? playbackState
      : createPlaybackState(videoUrl)

  const updatePlaybackState = (updates: Partial<PlaybackState>) => {
    setPlaybackState((current) => ({
      ...(current.source === videoUrl
        ? current
        : createPlaybackState(videoUrl)),
      ...updates,
    }))
  }

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

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) {
      return
    }

    const nextTime = Math.min(
      Math.max(time, 0),
      currentPlaybackState.duration || 0,
    )
    video.currentTime = nextTime
    updatePlaybackState({ currentTime: nextTime })
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
          className="preview-canvas"
          data-testid="preview-stage"
          data-playback-key={playbackKey}
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
              onTimeUpdate={(event) =>
                updatePlaybackState({
                  currentTime: event.currentTarget.currentTime,
                })
              }
              onDurationChange={(event) => {
                const nextDuration = event.currentTarget.duration
                updatePlaybackState({
                  duration: Number.isFinite(nextDuration) ? nextDuration : 0,
                })
              }}
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
          <div className="motion-slot" key={`${motionId}-${playbackKey}`}>
            {renderMotion(motionId, params)}
          </div>
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
