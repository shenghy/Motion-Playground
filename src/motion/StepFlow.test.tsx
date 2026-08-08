import { render, screen } from '@testing-library/react'
import { getMotionDefinition } from './registry'
import { StepFlow } from './StepFlow'
import type { StepFlowParams } from './types'

const params: StepFlowParams = {
  eyebrow: '06 / PROCESS MAP',
  title: '发布流程',
  step1: '明确目标',
  step2: '准备内容',
  step3: '构建版本',
  step4: '验证结果',
  step5: '修正问题',
  step6: '最终确认',
  step7: '正式发布',
  focusStep: '3',
  statusLabel: 'CURRENT',
  statusNote: 'BUILD / ACTIVE',
  stepDuration: 1.1,
}

describe('StepFlow', () => {
  it('exposes seven editable steps and seven focus choices', () => {
    const definition = getMotionDefinition('step-flow')
    const controlKeys = definition.controls.map((control) => control.key)
    const focusControl = definition.controls.find(
      (control) => control.key === 'focusStep',
    )

    expect(controlKeys).toEqual(expect.arrayContaining(['step6', 'step7']))
    expect(definition.defaults).toMatchObject({
      step4: '内部检查',
      step5: '修正问题',
      step6: '最终确认',
      step7: '正式发布',
    })
    expect(focusControl).toMatchObject({
      type: 'select',
      options: expect.arrayContaining([
        expect.objectContaining({ value: '6' }),
        expect.objectContaining({ value: '7' }),
      ]),
    })
  })

  it('renders seven steps and starts the sequence from step six', () => {
    const sevenStepParams = {
      ...params,
      step6: '最终确认',
      step7: '正式发布',
      focusStep: '6',
    } as unknown as StepFlowParams

    render(<StepFlow params={sevenStepParams} />)

    expect(screen.getAllByTestId('flow-step')).toHaveLength(7)
    expect(screen.getByText('最终确认')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-step')[5]).toHaveAttribute(
      'data-initial-focus',
      'true',
    )
    expect(screen.getAllByTestId('flow-step')[5]).toHaveAttribute(
      'data-sequence-order',
      '0',
    )
    expect(screen.getByTestId('flow-path')).toHaveAttribute(
      'viewBox',
      '0 0 80 600',
    )
    expect(screen.getByTestId('flow-path-baseline')).toHaveAttribute(
      'd',
      'M40 18 L40 582',
    )
    expect(screen.getAllByTestId('flow-path-segment')).toHaveLength(6)
    expect(screen.getAllByTestId('flow-path-segment')[5]).toHaveAttribute(
      'data-sequence-order',
      '0',
    )
    expect(screen.getAllByTestId('flow-path-segment')[0]).toHaveAttribute(
      'data-sequence-order',
      '2',
    )
    expect(
      screen.getAllByTestId('flow-step-number')[0],
    ).toHaveAttribute(
      'data-color-sequence',
      'future-gray,current-blue,complete-muted-blue',
    )
    expect(screen.getByTestId('flow-primary')).toHaveStyle({
      '--step-count': '7',
    })
  })

  it('renders five steps with a configured focus in safe zones', () => {
    render(<StepFlow params={{ ...params, step6: '', step7: '' }} />)

    expect(screen.getByText('发布流程')).toBeInTheDocument()
    expect(screen.getByText('明确目标')).toBeInTheDocument()
    expect(screen.getByText('修正问题')).toBeInTheDocument()
    expect(screen.getAllByTestId('flow-step')).toHaveLength(5)
    expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
      'data-initial-focus',
      'true',
    )
    expect(screen.getAllByTestId('flow-step')[2]).toHaveAttribute(
      'data-sequence-order',
      '0',
    )
    expect(screen.queryByText('BUILD / ACTIVE')).not.toBeInTheDocument()
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
      screen.getAllByTestId('flow-step')[2].querySelector('b'),
    ).toHaveAttribute('data-active-accent', 'animated')
    expect(
      screen
        .getByTestId('flow-primary')
        .querySelector('.motion-content-text'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('flow-primary').querySelector(
        '.motion-handwriting, [data-handwritten]',
      ),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('flow-secondary')).not.toBeInTheDocument()
  })

  it('supports a compact three-step flow', () => {
    render(<StepFlow params={{
      ...params,
      step4: '',
      step5: '',
      step6: '',
      step7: '',
    }} />)

    expect(screen.getAllByTestId('flow-step')).toHaveLength(3)
  })
})
