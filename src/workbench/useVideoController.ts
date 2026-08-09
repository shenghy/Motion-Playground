import { useState } from 'react'

export interface VideoPreview {
  name: string
  url: string
  blob: Blob
  type: string
  lastModified: number
  restored: boolean
}

export function useVideoController() {
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null)
  const [pendingVideo, setPendingVideo] = useState<VideoPreview | null>(null)
  const [videoError, setVideoError] = useState('')

  return {
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
  }
}
