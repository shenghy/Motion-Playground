import { delayedProgress } from '../../export/frameMath'
import { sampleOnce, samplePencilEase } from '../../export/canvas/timing'
import { clampDataValue, resolveFocusIndex } from '../dataMath'
import type { BarCompareParams } from '../types'

function sampleTime(time: number, duration: number) {
  return Math.round(sampleOnce(time, duration) * 1e6) / 1e6
}

function visible(time: number, delay: number, enter = 0.65) {
  return samplePencilEase(delayedProgress(time, delay, enter))
}

export function getBarCompareState(params: BarCompareParams, localTime: number) {
  const cycle = Math.min(10, Math.max(4.8, params.duration))
  const time = sampleTime(localTime, cycle)
  const source = [
    { label: params.item1Label, value: params.item1Value },
    { label: params.item2Label, value: params.item2Value },
    { label: params.item3Label, value: params.item3Value },
    { label: params.item4Label, value: params.item4Value },
  ].filter((item) => item.label.trim()).slice(0, 4).map((item) => ({
    ...item,
    value: clampDataValue(item.value, 9999),
  }))
  const safeItems = source.length >= 2 ? source : [
    { label: 'A', value: 42 },
    { label: 'B', value: 86 },
  ]
  const values = safeItems.map((item) => item.value)
  const maximum = Math.max(...values, 1)
  const focusIndex = resolveFocusIndex(values, params.focusIndex)
  return {
    cycle,
    time,
    focusIndex,
    headerOpacity: visible(time, 0.18),
    baselineReveal: visible(time, 0.48),
    resultOpacity: visible(time, 2.05),
    items: safeItems.map((item, index) => ({
      ...item,
      height: Math.max(0.12, item.value / maximum),
      focused: index === focusIndex,
      barReveal: visible(time, 0.72 + index * 0.14),
      labelOpacity: visible(time, 1.04 + index * 0.14),
    })),
  }
}
