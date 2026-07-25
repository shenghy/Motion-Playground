import { fireEvent, render, screen } from '@testing-library/react'
import { Workbench } from './Workbench'

describe('Workbench', () => {
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
})
