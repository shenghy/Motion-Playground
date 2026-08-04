import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export function formatCountUp(
  target: number,
  duration: number,
  decimals = 0,
  playbackTime = 0,
) {
  const safeDuration = Math.max(0.2, duration)
  const progress = Math.min(1, Math.max(0, playbackTime / safeDuration))
  const eased = 1 - Math.pow(1 - progress, 4)
  return (target * eased).toFixed(decimals)
}

export function useCountUp(
  target: number,
  duration: number,
  decimals = 0,
  playbackTime?: number,
) {
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (reduceMotion) return

    let frame = 0
    const startedAt = performance.now()
    const milliseconds = Math.max(0.2, duration) * 1000

    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / milliseconds)
      const eased = 1 - Math.pow(1 - progress, 4)
      setValue(target * eased)
      if (progress < 1) frame = requestAnimationFrame(update)
    }

    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [duration, reduceMotion, target])

  if (playbackTime !== undefined) {
    return formatCountUp(target, duration, decimals, playbackTime)
  }

  return (reduceMotion ? target : value).toFixed(decimals)
}
