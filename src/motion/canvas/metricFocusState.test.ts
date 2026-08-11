import { describe, expect, it } from 'vitest'
import type { MetricFocusParams } from '../types'
import { getMetricFocusState } from './metricFocusState'

const params: MetricFocusParams = {
  eyebrow: '效率提升',
  value: 61,
  prefix: '+',
  suffix: '%',
  description: '平均处理速度',
  trend: '上升 18 点',
  decimals: 1,
  duration: 1.2,
}

describe('metric focus canvas state', () => {
  it('formats the count-up from the shared deterministic clock', () => {
    expect(getMetricFocusState(params, 0).number).toBe('0.0')
    expect(getMetricFocusState(params, 0.6).number).toBe('57.2')
    expect(getMetricFocusState(params, 1.2).number).toBe('61.0')
    expect(getMetricFocusState(params, 8).number).toBe('61.0')
  })

  it('samples delayed layers and settles after entrance', () => {
    expect(getMetricFocusState(params, 0)).not.toHaveProperty('bar')
    const beforeEyebrow = getMetricFocusState(params, 0.12)
    expect(beforeEyebrow.eyebrow.opacity).toBe(0)
    expect(beforeEyebrow.eyebrow.y).toBe(18)
    expect(beforeEyebrow.value.opacity).toBe(0)
    expect(beforeEyebrow.value.blur).toBe(12)

    const beforeMeta = getMetricFocusState(params, 0.42)
    expect(beforeMeta.meta.y).toBe(18)

    const middle = getMetricFocusState(params, 0.8)
    expect(middle.eyebrow.opacity).toBeGreaterThan(0.99)
    expect(middle.meta.opacity).toBeGreaterThan(0)
    expect(middle).not.toHaveProperty('scan')

    const settled = getMetricFocusState(params, 8)
    expect(settled.value.opacity).toBe(1)
    expect(settled.value.scale).toBe(1)
    expect(settled.value.blur).toBe(0)
    expect(settled).not.toHaveProperty('bar')
    expect(settled).not.toHaveProperty('secondary')
    expect(settled.pencilLine.reveal).toBe(1)
    expect(settled.ticks.reveal).toBe(1)
  })
})
