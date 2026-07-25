interface VideoPlaybackControlsProps {
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  onTogglePlayback: () => void
  onToggleMuted: () => void
  onSeek: (time: number) => void
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00'
  }

  const seconds = Math.floor(value)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function VideoPlaybackControls({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  onTogglePlayback,
  onToggleMuted,
  onSeek,
}: VideoPlaybackControlsProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeCurrentTime = Math.min(Math.max(currentTime, 0), safeDuration)

  return (
    <section className="video-playback-controls" aria-label="视频播放控制">
      <button
        className="video-playback-controls__button"
        type="button"
        aria-label={isPlaying ? '暂停视频' : '播放视频'}
        onClick={onTogglePlayback}
      >
        <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
      </button>
      <input
        className="video-playback-controls__progress"
        type="range"
        aria-label="视频进度"
        min={0}
        max={safeDuration}
        step={0.01}
        value={safeCurrentTime}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <output className="video-playback-controls__time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </output>
      <button
        className="video-playback-controls__button"
        type="button"
        aria-label={isMuted ? '开启声音' : '静音'}
        onClick={onToggleMuted}
      >
        <span aria-hidden="true">{isMuted ? '静' : '声'}</span>
      </button>
    </section>
  )
}
