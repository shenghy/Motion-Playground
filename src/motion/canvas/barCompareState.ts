import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import { clampDataValue, resolveFocusIndex } from '../dataMath'
import type { BarCompareParams } from '../types'

function loopTime(time: number, duration: number, repeatDelay: number) {
  return Math.round(sampleCycle(time, duration, repeatDelay) * 1e6) / 1e6
}

function visible(time: number, delay: number, enter = 0.65) {
  return samplePencilEase(delayedProgress(time, delay, enter))
}

export function getBarCompareState(params: BarCompareParams, localTime: number) {
  const cycle = Math.min(10, Math.max(4.8, params.duration))
  const time = loopTime(localTime, cycle, 0.7)
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
  const exit = time >= cycle - 0.55
    ? Math.max(0, (cycle - time) / 0.55)
    : 1

  return {
    cycle,
    time,
    focusIndex,
    headerOpacity: visible(time, 0.18) * exit,
    baselineReveal: visible(time, 0.48) * exit,
    resultOpacity: visible(time, 2.05) * exit,
    items: safeItems.map((item, index) => ({
      ...item,
      height: Math.max(0.12, item.value / maximum),
      focused: index === focusIndex,
      barReveal: visible(time, 0.72 + index * 0.14) * exit,
      labelOpacity: visible(time, 1.04 + index * 0.14) * exit,
    })),
  }
}
