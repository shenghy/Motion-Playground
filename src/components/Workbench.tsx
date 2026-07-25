import { useEffect, useMemo, useRef, useState } from 'react'
import { motionRegistry, getMotionDefinition } from '../motion/registry'
import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import { ComponentRail } from './ComponentRail'
import { ParameterPanel } from './ParameterPanel'
import { PreviewStage } from './PreviewStage'

const createInitialParameters = () => {
  const initial = {} as Record<MotionId, ParameterValues>
  motionRegistry.forEach((definition) => {
    initial[definition.id] = { ...definition.defaults }
  })
  return initial
}

interface VideoPreview {
  name: string
  url: string
}

export function Workbench() {
  const [activeId, setActiveId] = useState<MotionId>('metric-focus')
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [parameters, setParameters] = useState(createInitialParameters)
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null)
  const [pendingVideo, setPendingVideo] = useState<VideoPreview | null>(null)
  const [videoError, setVideoError] = useState('')
  const videoPreviewRef = useRef<VideoPreview | null>(null)
  const pendingVideoRef = useRef<VideoPreview | null>(null)
  const [playbackKeys, setPlaybackKeys] = useState<Record<MotionId, number>>({
    'metric-focus': 0,
    'compare-split': 0,
    'profile-reveal': 0,
    'bar-compare': 0,
    'share-ring': 0,
    'step-flow': 0,
  })

  const activeDefinition = useMemo(() => getMotionDefinition(activeId), [activeId])
  const activeParameters = parameters[activeId]

  const replay = () => {
    setPlaybackKeys((current) => ({
      ...current,
      [activeId]: current[activeId] + 1,
    }))
  }

  const selectMotion = (id: MotionId) => {
    setActiveId(id)
    setPlaybackKeys((current) => ({ ...current, [id]: current[id] + 1 }))
  }

  const updateParameter = (key: string, value: ParameterValue) => {
    setParameters((current) => ({
      ...current,
      [activeId]: { ...current[activeId], [key]: value },
    }))
    replay()
  }

  const resetParameters = () => {
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
  }

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
        />
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
