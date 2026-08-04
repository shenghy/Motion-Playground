import { delayedProgress } from '../../export/frameMath'
import { sampleCycle, samplePencilEase } from '../../export/canvas/timing'
import { normalizeShares, resolveFocusIndex } from '../dataMath'
import type { ShareRingParams } from '../types'

function progress(time: number, delay: number, duration = 0.72) {
  return samplePencilEase(delayedProgress(time, delay, duration))
}

export function getShareRingState(params: ShareRingParams, localTime: number) {
  const cycle = Math.min(10, Math.max(5, params.duration))
  const time = Math.round(sampleCycle(localTime, cycle, 0.75) * 1e6) / 1e6
  const source = [
    { label: params.item1Label, value: params.item1Value },
    { label: params.item2Label, value: params.item2Value },
    { label: params.item3Label, value: params.item3Value },
    { label: params.item4Label, value: params.item4Value },
  ].filter((item) => item.label.trim()).slice(0, 4)
  const safeItems = source.length >= 2 ? source : [
    { label: '主要部分', value: 68 },
    { label: '其他部分', value: 32 },
  ]
  const percentages = normalizeShares(safeItems.map((item) => item.value))
  const focusIndex = resolveFocusIndex(safeItems.map((item) => item.value), params.focusIndex)
  const exit = time >= cycle - 0.6 ? Math.max(0, (cycle - time) / 0.6) : 1
  let offset = 0
  const items = safeItems.map((item, index) => {
    const percentage = percentages[index]
    const result = {
      ...item,
      percentage,
      offset,
      focused: index === focusIndex,
      reveal: progress(time, 0.5 + index * 0.2) * exit,
      labelOpacity: progress(time, 1.72 + index * 0.12) * exit,
    }
    offset += percentage
    return result
  })
  return {
    cycle,
    time,
    focusIndex,
    focusPercentage: Math.round(items[focusIndex].percentage),
    headerOpacity: progress(time, 0.16) * exit,
    centerOpacity: progress(time, 1.55) * exit,
    resultOpacity: progress(time, 2.35) * exit,
    items,
  }
}
