import { render, screen } from '@testing-library/react'
import { StepFlow } from './StepFlow'
import type { StepFlowParams } from './types'

const params: StepFlowParams = {
  eyebrow: '06 / PROCESS MAP',
  title: '发布流程',
  step1: '明确目标',
  step2: '准备内容',
  step3: '构建版本',
  step4: '验证结果',
  step5: '正式发布',
  focusStep: '3',
  statusLabel: 'CURRENT',
  statusNote: 'BUILD / ACTIVE',
  stepDuration: 1.1,
}

describe('StepFlow', () => {
  it('renders five steps with a configured focus in safe zones', () => {
    render(<StepFlow params={params} />)

    expect(screen.getByText('发布流程')).toBeInTheDocument()
    expect(screen.getByText('明确目标')).toBeInTheDocument()
    expect(screen.getByText('正式发布')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-step')).toHaveLength(5)
    expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
      'data-initial-focus',
      'true',
    )
    expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
      'data-sequence-order',
      '0',
    )
    expect(screen.getByText('BUILD / ACTIVE')).toBeInTheDocument()
    expect(screen.getByTestId('flow-primary')).toHaveAttribute(
      'data-zone',
      'left-primary',
    )
    expect(screen.getByTestId('flow-primary')).toHaveAttribute(
      'data-pencil-layout',
      'drawn-path',
    )
    expect(screen.getByTestId('flow-path')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
      'data-pencil-weight',
      'double',
    )
    expect(
      screen
        .getByTestId('flow-primary')
        .querySelector('[data-handwritten="true"]'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('flow-secondary')).toHaveAttribute(
      'data-zone',
      'right-secondary',
    )
  })

  it('supports a compact three-step flow', () => {
    render(<StepFlow params={{ ...params, step4: '', step5: '' }} />)

    expect(screen.getAllByTestId('flow-step')).toHaveLength(3)
  })
})
