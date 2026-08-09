import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { resolveFocusIndex } from './dataMath'
import { PencilTexture } from './PencilTexture'
import { getStepFlowState } from './canvas/stepFlowState'
import type { MotionComponentProps, StepFlowParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const

export function StepFlow({ params, playbackTime }: MotionComponentProps<StepFlowParams>) {
  const reduceMotion = useReducedMotion()
  const sourceSteps = [
    params.step1,
    params.step2,
    params.step3,
    params.step4,
    params.step5,
    params.step6,
    params.step7,
  ]
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 7)
  const steps = sourceSteps.length >= 3
    ? sourceSteps
    : ['明确目标', '执行方案', '验证结果']
  const focusIndex = resolveFocusIndex(
    steps.map(() => 1),
    params.focusStep,
  )
  const orderedIndexes = Array.from(
    { length: steps.length },
    (_, offset) => (focusIndex + offset) % steps.length,
  )
  const hold = Math.min(2.4, Math.max(0.7, params.stepDuration))
  const cycle = steps.length * hold + 1.1
  const sampled = playbackTime === undefined ? null : getStepFlowState(params, playbackTime)

  const stepTransition = (index: number) => {
    if (reduceMotion || sampled) return { duration: 0 }

    const phase = orderedIndexes.indexOf(index)
    const start = 0.42 + phase * hold
    const end = start + hold

    return {
      duration: cycle,
      times: [
        0,
        start / cycle,
        (start + 0.18) / cycle,
        (end - 0.18) / cycle,
        end / cycle,
        1,
      ],
      ease,
    }
  }

  return (
    <div
      className="motion-canvas step-flow"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="grain" />
      <div className="step-flow__wash" aria-hidden="true" />

      <section
        className="step-flow__card"
        data-testid="flow-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-pencil-layout="drawn-path"
        style={{ '--step-count': steps.length } as CSSProperties}
      >
        <motion.header
          className="data-card__heading"
          initial={reduceMotion || sampled ? false : { opacity: 0, y: 14 }}
          animate={sampled
            ? { opacity: sampled.headerOpacity, y: 14 * (1 - sampled.headerOpacity) }
            : reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 1, 1], y: [14, 0, 0] }}
          transition={reduceMotion || sampled
            ? { duration: 0 }
            : {
                duration: cycle * 0.08,
                times: [0, 1],
                ease,
              }}
        >
          <span>{params.eyebrow || '06 / 流程图'}</span>
          <h2 className="motion-content-text">
            {params.title || '未命名流程'}
          </h2>
        </motion.header>

        <div className="step-flow__steps">
          <svg
            className="step-flow__path"
            data-testid="flow-path"
            viewBox="0 0 80 600"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="step-flow__path-baseline"
              data-testid="flow-path-baseline"
              d="M40 18 L40 582"
            />
            {steps.slice(0, -1).map((_, index) => {
              const sequenceOrder = orderedIndexes.indexOf(index)
              const segmentHeight = 564 / (steps.length - 1)
              const revealAt = (0.42 + (sequenceOrder + 1) * hold) / cycle
              const settleAt = Math.min(revealAt + 0.03, 0.97)

              return (
                <motion.line
                  className="step-flow__path-segment"
                  data-testid="flow-path-segment"
                  data-sequence-order={sequenceOrder}
                  key={`segment-${index}`}
                  x1="40"
                  x2="40"
                  y1={18 + segmentHeight * index}
                  y2={18 + segmentHeight * (index + 1)}
                  pathLength={1}
                  initial={reduceMotion || sampled ? false : { pathLength: 0, opacity: 0 }}
                  animate={sampled
                    ? {
                        pathLength: sampled.items[index].completed ? 1 : 0,
                        opacity: sampled.connectorReveal * 0.78,
                      }
                    : reduceMotion
                    ? { pathLength: 0, opacity: 0 }
                    : {
                        pathLength: [0, 0, 1],
                        opacity: [0, 0, 0.78],
                      }}
                  transition={reduceMotion || sampled
                    ? { duration: 0 }
                    : {
                        duration: cycle * settleAt,
                        times: [0, revealAt / settleAt, 1],
                        ease,
                      }}
                />
              )
            })}
          </svg>

          {steps.map((step, index) => {
            const initialFocus = index === focusIndex
            const staticOpacity = initialFocus ? 1 : 0.42
            const sequenceOrder = orderedIndexes.indexOf(index)

            return (
              <motion.div
                className="step-flow__step"
                data-testid="flow-step"
                data-initial-focus={initialFocus}
                data-sequence-order={sequenceOrder}
                data-pencil-weight={initialFocus ? 'double' : 'light'}
                initial={reduceMotion || sampled ? false : { opacity: 0.34, scale: 1 }}
                animate={sampled
                  ? {
                      opacity: sampled.items[index].opacity,
                      scale: sampled.items[index].scale,
                      color: sampled.items[index].active > 0 ? '#f1f1ed' : sampled.items[index].completed ? '#557aa8' : '#676c71',
                    }
                  : reduceMotion
                  ? {
                      opacity: staticOpacity,
                      scale: initialFocus ? 1.1 : 1,
                      color: initialFocus ? '#f1f1ed' : '#676c71',
                    }
                  : {
                      opacity: [0.4, 0.4, 1, 1, 0.68, 0.68],
                      scale: [1, 1, 1.1, 1.1, 1, 1],
                      color: [
                        '#5d6267',
                        '#5d6267',
                        '#f1f1ed',
                        '#f1f1ed',
                        '#557aa8',
                        '#557aa8',
                      ],
                    }}
                transition={stepTransition(index)}
                key={`${step}-${index}`}
              >
                <motion.b
                  data-active-accent="animated"
                  data-testid="flow-step-number"
                  data-color-sequence="future-gray,current-blue,complete-muted-blue"
                  initial={reduceMotion || sampled
                    ? false
                    : {
                        color: '#72777b',
                        borderColor: '#666b70',
                        borderWidth: 2,
                      }}
                  animate={sampled
                    ? {
                        color: sampled.items[index].active > 0 ? '#2f67b2' : sampled.items[index].completed ? '#557aa8' : '#72777b',
                        borderColor: sampled.items[index].active > 0 ? '#2f67b2' : sampled.items[index].completed ? '#41658e' : '#666b70',
                        borderWidth: sampled.items[index].active > 0 ? 4 : 2,
                      }
                    : reduceMotion
                    ? {
                        color: initialFocus ? '#2f67b2' : '#72777b',
                        borderColor: initialFocus ? '#2f67b2' : '#666b70',
                        borderWidth: initialFocus ? 4 : 2,
                      }
                    : {
                        color: [
                          '#72777b',
                          '#72777b',
                          '#2f67b2',
                          '#2f67b2',
                          '#557aa8',
                          '#557aa8',
                        ],
                        borderColor: [
                          '#666b70',
                          '#666b70',
                          '#2f67b2',
                          '#2f67b2',
                          '#41658e',
                          '#41658e',
                        ],
                        borderWidth: [2, 2, 4, 4, 2, 2],
                      }}
                  transition={stepTransition(index)}
                >
                  {String(index + 1).padStart(2, '0')}
                </motion.b>
                <span className="motion-content-text">
                  {step}
                </span>
                <i aria-hidden="true" />
              </motion.div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
