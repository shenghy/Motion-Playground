const X1 = 0.22
const Y1 = 1
const X2 = 0.36
const Y2 = 1

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function cubic(t: number, first: number, second: number) {
  const inverse = 1 - t
  return 3 * inverse * inverse * t * first
    + 3 * inverse * t * t * second
    + t * t * t
}

function cubicDerivative(t: number, first: number, second: number) {
  const inverse = 1 - t
  return 3 * inverse * inverse * first
    + 6 * inverse * t * (second - first)
    + 3 * t * t * (1 - second)
}

export function samplePencilEase(progress: number) {
  const x = clamp01(progress)
  if (x === 0 || x === 1) return x

  let t = x
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = cubic(t, X1, X2) - x
    const derivative = cubicDerivative(t, X1, X2)
    if (Math.abs(error) < 1e-7 || Math.abs(derivative) < 1e-7) break
    t = clamp01(t - error / derivative)
  }

  if (Math.abs(cubic(t, X1, X2) - x) >= 1e-5) {
    let lower = 0
    let upper = 1
    for (let iteration = 0; iteration < 20; iteration += 1) {
      t = (lower + upper) / 2
      if (cubic(t, X1, X2) < x) lower = t
      else upper = t
    }
  }

  return clamp01(cubic(t, Y1, Y2))
}

export function sampleOnce(time: number, duration: number) {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0
  if (safeDuration === 0) return 0
  return Math.min(safeDuration, safeTime)
}
