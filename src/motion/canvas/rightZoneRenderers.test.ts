import { describe, expect, it, vi } from 'vitest'
import type {
  BarCompareParams,
  ProfileRevealParams,
  ShareRingParams,
  StepFlowParams,
} from '../types'
import type { CanvasMotionRenderer } from '../../export/canvas/types'
import { renderBarCompareToCanvas } from './barCompareRenderer'
import { renderProfileRevealToCanvas } from './profileRevealRenderer'
import { renderShareRingToCanvas } from './shareRingRenderer'
import { renderStepFlowToCanvas } from './stepFlowRenderer'

function createContext() {
  const fillText = vi.fn()
  const methods: Record<string, unknown> = {
    fillText,
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
  }
  const context = new Proxy(methods, {
    get(target, property) {
      if (property in target) return target[property as string]
      const method = vi.fn()
      target[property as string] = method
      return method
    },
    set(target, property, value) {
      target[property as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { context, fillText }
}

function expectRendererInsideLeftZone<T>(
  renderer: CanvasMotionRenderer<T>,
  params: T,
) {
  const { context, fillText } = createContext()
  renderer({
    ctx: context,
    params,
    localTime: 8,
    resources: {
      width: 1920,
      height: 1080,
      displayFont: 'Syne Variable',
      monoFont: 'IBM Plex Mono',
      contentFont: 'Noto Sans SC Variable',
    },
  })
  expect(
    fillText.mock.calls.every(([, x]) => Number(x) < 1152),
  ).toBe(true)
}

const profileParams: ProfileRevealParams = {
  category: 'MAKER', descriptor: 'BUILDER', overline: 'PROFILE', title: '人物',
  fact1: '事实一', fact1Note: 'NOTE 1', fact2: '事实二', fact2Note: 'NOTE 2',
  fact3: '事实三', fact3Note: 'NOTE 3', status: 'VERIFIED', duration: 6.4,
}

const barParams: BarCompareParams = {
  eyebrow: 'DATA', title: '季度增长', item1Label: 'Q1', item1Value: 32,
  item2Label: 'Q2', item2Value: 48, item3Label: 'Q3', item3Value: 67,
  item4Label: 'Q4', item4Value: 86, suffix: '%', focusIndex: '4',
  resultLabel: 'PEAK', resultNote: 'Q4', duration: 5.8,
}

const shareParams: ShareRingParams = {
  eyebrow: 'SHARE', title: '用户构成', item1Label: '核心', item1Value: 62,
  item2Label: '成长', item2Value: 20, item3Label: '观察', item3Value: 12,
  item4Label: '其他', item4Value: 6, focusIndex: '1', centerLabel: 'PRIMARY',
  resultLabel: 'SHARE', resultNote: 'DOMINANT', duration: 6,
}

const flowParams: StepFlowParams = {
  eyebrow: 'PROCESS', title: '发布流程', step1: '目标', step2: '内容',
  step3: '构建', step4: '验证', step5: '修正', step6: '确认', step7: '发布', focusStep: '3',
  statusLabel: 'CURRENT', statusNote: 'BUILD', stepDuration: 1.1,
}

describe('right-zone canvas contract', () => {
  it('keeps profile, bar, ring, and flow text inside the left 60 percent', () => {
    expectRendererInsideLeftZone(renderProfileRevealToCanvas, profileParams)
    expectRendererInsideLeftZone(renderBarCompareToCanvas, barParams)
    expectRendererInsideLeftZone(renderShareRingToCanvas, shareParams)
    expectRendererInsideLeftZone(renderStepFlowToCanvas, flowParams)
  })
})
