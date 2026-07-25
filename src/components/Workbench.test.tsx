import { fireEvent, render, screen } from '@testing-library/react'
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
