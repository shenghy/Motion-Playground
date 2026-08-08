import { motion, useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import type { MotionComponentProps, MetricFocusParams } from './types'
import { useCountUp } from './useCountUp'

const ease = [0.22, 1, 0.36, 1] as const

export function MetricFocus({
  params,
  playbackTime,
}: MotionComponentProps<MetricFocusParams>) {
  const reduceMotion = useReducedMotion()
  const count = useCountUp(
    params.value,
    params.duration,
    params.decimals,
    playbackTime,
  )
  const transition = (delay = 0) => ({
    duration: reduceMotion ? 0 : params.duration * 0.42,
    delay: reduceMotion ? 0 : delay,
    ease,
  })

  return (
    <div
      className="motion-canvas metric-focus"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="grain" />
      <div className="canvas-grid" aria-hidden="true" />
      <div className="canvas-coordinate coordinate--tl">横轴 0128 / 纵轴 0096</div>
      <div className="canvas-coordinate coordinate--br">画面 001</div>

      <div
        className="metric-focus__frame"
        data-testid="metric-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-metric-layout="axis-reading"
      >
        <motion.span
          className="metric-focus__english"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition(0.12)}
        >
          {params.eyebrow || '未命名指标'} / 02
        </motion.span>

        <motion.div
          className="metric-focus__value"
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={transition(0.2)}
          aria-label={`核心指标 ${params.prefix}${params.value.toFixed(params.decimals)}${params.suffix}`}
        >
          <span className="metric-focus__prefix">{params.prefix}</span>
          <span className="metric-focus__number" data-testid="metric-number">
            {count}
          </span>
          <span className="metric-focus__suffix">{params.suffix}</span>
        </motion.div>

        <motion.div
          className="metric-focus__axis"
          data-testid="metric-axis"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={transition(0.48)}
        >
          <i />
        </motion.div>

        <motion.div
          className="metric-focus__ticks"
          data-testid="metric-ticks"
          aria-hidden="true"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={transition(0.55)}
        >
          {Array.from({ length: 11 }, (_, index) => <i key={index} />)}
        </motion.div>

        <motion.div
          className="metric-focus__meta"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition(0.42)}
        >
          <span className="motion-content-text">
            {params.description || '暂无说明'}
          </span>
          <strong>{params.trend || '趋势稳定'}</strong>
        </motion.div>
      </div>
    </div>
  )
}
