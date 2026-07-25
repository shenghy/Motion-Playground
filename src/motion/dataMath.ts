export function clampDataValue(value: number, max: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, value))
}

export function normalizeShares(values: number[]) {
  if (values.length === 0) return []

  const safeValues = values.map((value) => clampDataValue(value, 10000))
  const total = safeValues.reduce((sum, value) => sum + value, 0)

  if (total === 0) {
    return safeValues.map(() => 100 / safeValues.length)
  }

  return safeValues.map((value) => (value / total) * 100)
}

export function resolveFocusIndex(values: number[], requested: string) {
  if (values.length === 0) return 0

  const parsed = Number.parseInt(requested, 10) - 1
  if (parsed >= 0 && parsed < values.length) return parsed

  return values.reduce(
    (largestIndex, value, index) => (
      value > values[largestIndex] ? index : largestIndex
    ),
    0,
  )
}
