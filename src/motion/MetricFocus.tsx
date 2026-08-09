import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getMetricFocusState } from './canvas/metricFocusState'
import { getMetricFocusTypography } from './metricFocusLayout'
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
  const sampled = playbackTime === undefined
    ? null
    : getMetricFocusState(params, playbackTime)
  const transition = (delay = 0) => ({
    duration: reduceMotion ? 0 : params.duration * 0.42,
    delay: reduceMotion ? 0 : delay,
    ease,
  })
  const typography = getMetricFocusTypography(
    params.value.toFixed(params.decimals),
    params.prefix,
    params.suffix,
  )
  const valueStyle = {
    flex: '0 1 auto',
    '--metric-number-size': `${typography.numberFontCqw}cqw`,
    '--metric-affix-size': `${typography.affixFontCqw}cqw`,
  } as CSSProperties

  return (
    <div
      className="motion-canvas metric-focus"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="grain" />
      <div className="canvas-grid" aria-hidden="true" />
      <div className="canvas-coordinate coordinate--tl">横轴 0128 / 纵轴 0096</div>

      <div
        className="metric-focus__frame"
        data-testid="metric-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-metric-layout="data-rail"
      >
        <motion.span
          className="metric-focus__english"
          initial={sampled || reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={sampled
            ? { opacity: sampled.eyebrow.opacity, y: sampled.eyebrow.y }
            : { opacity: 1, y: 0 }}
          transition={sampled ? { duration: 0 } : transition(0.12)}
        >
          {params.eyebrow || '未命名指标'} / 02
        </motion.span>

        <div className="metric-focus__value-rail" data-testid="metric-value-rail">
          <motion.div
            className="metric-focus__value"
            data-testid="metric-value"
            style={valueStyle}
            initial={sampled || reduceMotion ? false : { opacity: 0, scale: 0.94, filter: 'blur(12px)' }}
            animate={sampled
              ? {
                  opacity: sampled.value.opacity,
                  scale: sampled.value.scale,
                  filter: `blur(${sampled.value.blur}px)`,
                }
              : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={sampled ? { duration: 0 } : transition(0.2)}
            aria-label={`核心指标 ${params.prefix}${params.value.toFixed(params.decimals)}${params.suffix}`}
          >
            <span className="metric-focus__prefix">{params.prefix}</span>
            <span className="metric-focus__number" data-testid="metric-number">
              {count}
            </span>
            <span className="metric-focus__suffix">{params.suffix}</span>
          </motion.div>

          <div className="metric-focus__single-bar-track" aria-hidden="true">
            <motion.i
              data-testid="metric-single-bar"
              initial={sampled || reduceMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: sampled ? sampled.bar.reveal : 1 }}
              transition={sampled ? { duration: 0 } : transition(0.28)}
            />
          </div>
        </div>

        <motion.div
          className="metric-focus__meta"
          initial={sampled || reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={sampled
            ? { opacity: sampled.meta.opacity, y: sampled.meta.y }
            : { opacity: 1, y: 0 }}
          transition={sampled ? { duration: 0 } : transition(0.42)}
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
