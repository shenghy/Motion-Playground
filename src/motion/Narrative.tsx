import {
  motion,
  useReducedMotion,
  useTime,
  useTransform,
} from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getNarrativeState } from './canvas/narrativeState'
import type { MotionComponentProps, NarrativeParams } from './types'

export function Narrative({
  params,
  playbackTime,
}: MotionComponentProps<NarrativeParams>) {
  const reduceMotion = useReducedMotion()
  const clock = useTime()
  const liveState = useTransform(clock, (milliseconds) =>
    getNarrativeState(params, milliseconds / 1000))
  const liveLine1Opacity = useTransform(liveState, (state) => state.line1.opacity)
  const liveLine1Y = useTransform(liveState, (state) => state.line1.y)
  const liveLine1Blur = useTransform(
    liveState,
    (state) => `blur(${state.line1.blur}px)`,
  )
  const liveLine2Opacity = useTransform(liveState, (state) => state.line2.opacity)
  const liveLine2Y = useTransform(liveState, (state) => state.line2.y)
  const liveLine2Blur = useTransform(
    liveState,
    (state) => `blur(${state.line2.blur}px)`,
  )
  const liveRuleProgress = useTransform(
    liveState,
    (state) => state.ruleProgress,
  )
  const liveExplanationOpacity = useTransform(
    liveState,
    (state) => state.explanation.opacity,
  )
  const liveExplanationY = useTransform(
    liveState,
    (state) => state.explanation.y,
  )
  const liveExplanationBlur = useTransform(
    liveState,
    (state) => `blur(${state.explanation.blur}px)`,
  )
  const sampled = playbackTime === undefined
    ? null
    : getNarrativeState(params, playbackTime)

  const line1Style = reduceMotion
    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
    : sampled
      ? {
          opacity: sampled.line1.opacity,
          y: sampled.line1.y,
          filter: `blur(${sampled.line1.blur}px)`,
        }
      : {
          opacity: liveLine1Opacity,
          y: liveLine1Y,
          filter: liveLine1Blur,
        }
  const line2Style = reduceMotion
    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
    : sampled
      ? {
          opacity: sampled.line2.opacity,
          y: sampled.line2.y,
          filter: `blur(${sampled.line2.blur}px)`,
        }
      : {
          opacity: liveLine2Opacity,
          y: liveLine2Y,
          filter: liveLine2Blur,
        }
  const ruleStyle = reduceMotion
    ? { opacity: 1, scaleX: 1 }
    : sampled
      ? { opacity: sampled.ruleProgress, scaleX: sampled.ruleProgress }
      : { opacity: liveRuleProgress, scaleX: liveRuleProgress }
  const explanationStyle = reduceMotion
    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
    : sampled
      ? {
          opacity: sampled.explanation.opacity,
          y: sampled.explanation.y,
          filter: `blur(${sampled.explanation.blur}px)`,
        }
      : {
          opacity: liveExplanationOpacity,
          y: liveExplanationY,
          filter: liveExplanationBlur,
        }

  return (
    <div
      className="motion-canvas narrative"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="grain" />
      <div className="canvas-grid canvas-grid--sparse" aria-hidden="true" />

      <section
        className="narrative__content"
        data-testid="narrative-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-pencil-layout="upper-left-narrative"
      >
        <span className="narrative__eyebrow" data-accent="deep-blue">
          NARRATIVE / 01
        </span>
        <div className="narrative__headline">
          <motion.h2 style={line1Style}>
            {params.line1 || '当前内容'}
          </motion.h2>
          <motion.h2 style={line2Style}>
            {params.line2 || '正在讲述'}
          </motion.h2>
        </div>
        <motion.i
          className="narrative__rule"
          aria-hidden="true"
          style={ruleStyle}
        />
        <motion.p style={explanationStyle}>
          {params.explanation || '补充当前视频内容的简短解释。'}
        </motion.p>
      </section>
    </div>
  )
}
