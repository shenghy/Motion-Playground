import { motion, useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import type { MotionComponentProps, MetricFocusParams } from './types'
import { useCountUp } from './useCountUp'

const ease = [0.22, 1, 0.36, 1] as const

export function MetricFocus({ params }: MotionComponentProps<MetricFocusParams>) {
  const reduceMotion = useReducedMotion()
  const count = useCountUp(params.value, params.duration, params.decimals)
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

      <motion.div
        className="metric-focus__scan"
        aria-hidden="true"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0.25] }}
        transition={{ duration: reduceMotion ? 0 : params.duration, times: [0, 0.45, 1], ease }}
      />

      <div
        className="metric-focus__frame"
        data-testid="metric-primary"
        data-zone="left-primary"
        data-pencil-layout="open-frame"
      >
        <i className="corner corner--tl" />
        <i className="corner corner--tr" />
        <i className="corner corner--bl" />
        <i className="corner corner--br" />

        <motion.div
          className="motion-eyebrow"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition(0.12)}
        >
          <span>01</span>
          {params.eyebrow || '未命名指标'}
        </motion.div>

        <motion.div
          className="metric-focus__value"
          initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={transition(0.2)}
          aria-label={`核心指标 ${params.prefix}${params.value.toFixed(params.decimals)}${params.suffix}`}
        >
          <span className="metric-focus__prefix">{params.prefix}</span>
          <span className="metric-focus__number">{count}</span>
          <span className="metric-focus__suffix">{params.suffix}</span>
        </motion.div>

        <motion.div
          className="metric-focus__meta"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition(0.42)}
        >
          <span>{params.description || '暂无说明'}</span>
        </motion.div>

        <motion.i
          className="metric-focus__pencil-line"
          data-testid="metric-pencil-line"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={transition(0.48)}
        />

        <motion.div
          className="metric-focus__ticks"
          aria-hidden="true"
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={transition(0.55)}
        >
          {Array.from({ length: 17 }, (_, index) => <i key={index} />)}
        </motion.div>
      </div>

      <motion.aside
        className="metric-focus__secondary"
        data-testid="metric-secondary"
        data-zone="right-secondary"
        initial={{ opacity: 0, x: 34 }}
        animate={{ opacity: 1, x: 0 }}
        transition={transition(0.5)}
      >
        <span>变化 / 实时</span>
        <strong>{params.trend || '—'}</strong>
        <i aria-hidden="true" />
        <small>指标<br />已锁定</small>
      </motion.aside>
    </div>
  )
}
