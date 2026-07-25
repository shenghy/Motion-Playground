import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Workbench } from './Workbench'

describe('Workbench', () => {
  const createObjectURL = vi.fn(() => 'blob:local-video-preview')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the Chinese component library and switches between all motions', () => {
    const { container } = render(<Workbench />)
    const expectPencilStyle = () => {
      expect(container.querySelector('.motion-canvas')).toHaveAttribute(
        'data-pencil-style',
        'silver-on-black',
      )
    }

    expect(screen.getByText('系统就绪')).toBeInTheDocument()
    expect(screen.getByText('参数设置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /核心指标/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
    expect(screen.getByText('1.4秒')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: /对比卡片/ }))
    expect(screen.getByText('提升 2.05 倍')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: /人物信息/ }))
    expect(screen.getByText('公开构建者')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /QuoteLockup/ })).not.toBeInTheDocument()
    expectPencilStyle()

    expect(
      screen.getAllByRole('button', {
        name: /核心指标|对比卡片|人物信息|柱状对比|环形占比|步骤流程/,
      }),
    ).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: /柱状对比/ }))
    expect(screen.getByText('季度增长')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: /环形占比/ }))
    expect(screen.getByText('用户构成')).toBeInTheDocument()
    expectPencilStyle()

    fireEvent.click(screen.getByRole('button', { name: /步骤流程/ }))
    expect(screen.getByText('发布流程')).toBeInTheDocument()
    expectPencilStyle()

    expect(screen.queryByText('MOTION PLAYGROUND')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPONENTS')).not.toBeInTheDocument()
    expect(screen.queryByText('PARAMETERS')).not.toBeInTheDocument()
    expect(screen.queryByText('SYSTEM READY')).not.toBeInTheDocument()
  })

  it('applies live changes and restarts playback', () => {
    render(<Workbench />)
    const stage = screen.getByTestId('preview-stage')
    const initialKey = stage.dataset.playbackKey

    fireEvent.change(screen.getByLabelText('核心数值'), { target: { value: '320' } })
    expect(screen.getByLabelText('核心指标 +320%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新播放' }))
    expect(stage.dataset.playbackKey).not.toBe(initialKey)

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }))
    expect(screen.getByLabelText('核心指标 +248%')).toBeInTheDocument()
  })

  it('shows the presenter background and lets the safety guide be hidden', () => {
    render(<Workbench />)

    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toHaveAttribute('src', '/reference-standing.png')
    expect(screen.getByTestId('presenter-safe-area')).toBeInTheDocument()
    expect(screen.getByTestId('subtitle-safe-area')).toHaveTextContent(
      '字幕安全区 / 150像素',
    )

    const toggle = screen.getByRole('switch', { name: '显示人物安全区' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)

    expect(screen.queryByTestId('presenter-safe-area')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subtitle-safe-area')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '口播人物参考背景' })).toBeInTheDocument()
  })

  it('imports a local video and keeps it mounted while motion copy changes', () => {
    render(<Workbench />)
    const file = new File(['video-bytes'], '我的口播.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    expect(screen.getByText('正在检查')).toBeInTheDocument()
    const validationProbe = screen.getByTestId('video-validation-probe')
    expect(validationProbe).toHaveAttribute('preload', 'auto')
    fireEvent.canPlay(validationProbe)

    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    expect(video).toHaveAttribute('src', 'blob:local-video-preview')
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('playsinline')
    expect(video.muted).toBe(true)
    expect(screen.getByText('我的口播.mp4')).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: '口播人物参考背景' }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '实时文字预览' },
    })
    expect(screen.getByTestId('presenter-video')).toBe(video)

    fireEvent.click(screen.getByRole('button', { name: /对比卡片/ }))
    expect(screen.getByTestId('presenter-video')).toBe(video)

    fireEvent.click(screen.getByRole('button', { name: '移除视频' }))
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-video-preview')
  })

  it('controls video playback, sound, progress, and keeps state across motions', () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined)
    render(<Workbench />)
    const file = new File(['video-with-audio'], '带声音口播.mp4', {
      type: 'video/mp4',
    })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    const video = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: 125,
    })
    fireEvent.durationChange(video)
    video.currentTime = 35
    fireEvent.timeUpdate(video)
    fireEvent.play(video)

    expect(screen.getByRole('button', { name: '暂停视频' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开启声音' })).toBeInTheDocument()
    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '125')
    expect(screen.getByLabelText('视频进度')).toHaveValue('35')
    expect(screen.getByText('00:35 / 02:05')).toBeInTheDocument()

    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false,
    })
    fireEvent.click(screen.getByRole('button', { name: '暂停视频' }))
    expect(pause).toHaveBeenCalled()
    fireEvent.pause(video)

    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: true,
    })
    fireEvent.click(screen.getByRole('button', { name: '播放视频' }))
    expect(play).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '开启声音' }))
    expect(video.muted).toBe(false)
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('视频进度'), {
      target: { value: '50' },
    })
    expect(video.currentTime).toBe(50)
    expect(screen.getByText('00:50 / 02:05')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('指标名称'), {
      target: { value: '声音实时预览' },
    })
    fireEvent.click(screen.getByRole('button', { name: /对比卡片/ }))

    expect(screen.getByTestId('presenter-video')).toBe(video)
    expect(video.muted).toBe(false)
    expect(screen.getByLabelText('视频进度')).toBeInTheDocument()

  })

  it('ignores a rejected play promise from a replaced video source', async () => {
    createObjectURL
      .mockReturnValueOnce('blob:old-playback-source')
      .mockReturnValueOnce('blob:new-playback-source')
    let rejectOldPlayback!: (reason?: unknown) => void
    const oldPlayback = new Promise<void>((_, reject) => {
      rejectOldPlayback = reject
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(oldPlayback)
    render(<Workbench />)
    const oldFile = new File(['old'], '旧视频.mp4', { type: 'video/mp4' })
    const newFile = new File(['new'], '新视频.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [oldFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const oldVideo = screen.getByTestId('presenter-video')
    Object.defineProperty(oldVideo, 'paused', {
      configurable: true,
      value: true,
    })
    fireEvent.click(screen.getByRole('button', { name: '播放视频' }))

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [newFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const newVideo = screen.getByTestId('presenter-video') as HTMLVideoElement
    Object.defineProperty(newVideo, 'duration', {
      configurable: true,
      value: 60,
    })
    fireEvent.durationChange(newVideo)
    newVideo.currentTime = 10
    fireEvent.timeUpdate(newVideo)
    fireEvent.play(newVideo)

    await act(async () => {
      rejectOldPlayback(new Error('旧视频播放被中断'))
      await oldPlayback.catch(() => undefined)
    })

    expect(screen.getByTestId('presenter-video')).toBe(newVideo)
    expect(screen.getByRole('button', { name: '暂停视频' })).toBeInTheDocument()
    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '60')
    expect(screen.getByLabelText('视频进度')).toHaveValue('10')
  })

  it('normalizes non-finite media time values in the playback controls', () => {
    render(<Workbench />)
    const file = new File(['video'], '异常时长.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const video = screen.getByTestId('presenter-video')
    Object.defineProperty(video, 'duration', {
      configurable: true,
      value: Number.POSITIVE_INFINITY,
    })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      value: Number.NaN,
      writable: true,
    })

    fireEvent.durationChange(video)
    fireEvent.timeUpdate(video)

    expect(screen.getByLabelText('视频进度')).toHaveAttribute('max', '0')
    expect(screen.getByLabelText('视频进度')).toHaveValue('0')
    expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument()
  })

  it('rejects a non-video file without replacing the reference background', () => {
    render(<Workbench />)
    const file = new File(['not-video'], '文档.txt', { type: 'text/plain' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })

    expect(screen.getByText('请选择有效的视频文件')).toBeInTheDocument()
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('revokes replaced and active video URLs to release browser memory', () => {
    createObjectURL
      .mockReturnValueOnce('blob:first-video')
      .mockReturnValueOnce('blob:second-video')
    const { unmount } = render(<Workbench />)
    const firstFile = new File(['first'], '第一段.mp4', { type: 'video/mp4' })
    const secondFile = new File(['second'], '第二段.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [firstFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [secondFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))

    expect(screen.getByTestId('presenter-video')).toHaveAttribute(
      'src',
      'blob:second-video',
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first-video')

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second-video')
  })

  it('keeps the current preview when a replacement video cannot be decoded', () => {
    createObjectURL
      .mockReturnValueOnce('blob:working-video')
      .mockReturnValueOnce('blob:broken-video')
    render(<Workbench />)
    const workingFile = new File(['working'], '可播放.mp4', { type: 'video/mp4' })
    const brokenFile = new File(['broken'], '损坏视频.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [workingFile] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    const workingVideo = screen.getByTestId('presenter-video')

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [brokenFile] },
    })
    expect(screen.getByTestId('presenter-video')).toBe(workingVideo)
    fireEvent.error(screen.getByTestId('video-validation-probe'))

    expect(screen.getByText('无法读取此视频，请更换文件')).toBeInTheDocument()
    expect(screen.getByTestId('presenter-video')).toBe(workingVideo)
    expect(screen.getByTestId('presenter-video')).toHaveAttribute(
      'src',
      'blob:working-video',
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken-video')
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:working-video')
  })

  it('cancels a pending candidate when the latest selection is invalid', () => {
    createObjectURL.mockReturnValueOnce('blob:pending-video')
    render(<Workbench />)
    const pendingFile = new File(['pending'], '等待检查.mp4', { type: 'video/mp4' })
    const invalidFile = new File(['invalid'], '不是视频.txt', { type: 'text/plain' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [pendingFile] },
    })
    expect(screen.getByTestId('video-validation-probe')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [invalidFile] },
    })

    expect(screen.queryByTestId('video-validation-probe')).not.toBeInTheDocument()
    expect(screen.getByText('请选择有效的视频文件')).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending-video')
  })

  it('falls back to the reference image if an active video later fails', () => {
    createObjectURL.mockReturnValueOnce('blob:runtime-failure')
    render(<Workbench />)
    const file = new File(['video'], '后续损坏.mp4', { type: 'video/mp4' })

    fireEvent.change(screen.getByLabelText('导入本地视频'), {
      target: { files: [file] },
    })
    fireEvent.canPlay(screen.getByTestId('video-validation-probe'))
    fireEvent.error(screen.getByTestId('presenter-video'))

    expect(screen.getByText('视频播放失败，请更换文件')).toBeInTheDocument()
    expect(screen.queryByTestId('presenter-video')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '口播人物参考背景' }),
    ).toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:runtime-failure')
  })
})
