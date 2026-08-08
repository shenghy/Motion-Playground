import { motion, useReducedMotion } from 'motion/react'
import { resolveFocusIndex } from './dataMath'
import { PencilTexture } from './PencilTexture'
import type { MotionComponentProps, StepFlowParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const

export function StepFlow({ params }: MotionComponentProps<StepFlowParams>) {
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
  const connectorTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: cycle,
        times: [0, 0.12, 0.9, 1],
        repeat: Infinity,
        repeatDelay: 0.72,
        ease,
      }

  const stepTransition = (index: number) => {
    if (reduceMotion) return { duration: 0 }

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
      repeat: Infinity,
      repeatDelay: 0.72,
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
      >
        <motion.header
          className="data-card__heading"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 1, 1, 0], y: [14, 0, 0, -5] }}
          transition={reduceMotion
            ? { duration: 0 }
            : {
                duration: cycle,
                times: [0, 0.08, 0.91, 1],
                repeat: Infinity,
                repeatDelay: 0.72,
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
            viewBox="0 0 80 420"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path
              d="M42 6 C26 72 56 128 38 198 C22 264 56 330 38 414"
              pathLength={1}
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={reduceMotion
                ? { pathLength: 1 }
                : { pathLength: [0, 1, 1, 0] }}
              transition={connectorTransition}
            />
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
                initial={reduceMotion ? false : { opacity: 0.34, scale: 1 }}
                animate={reduceMotion
                  ? {
                      opacity: staticOpacity,
                      scale: initialFocus ? 1.3 : 1,
                      color: initialFocus ? '#f1f1ed' : '#676c71',
                    }
                  : {
                      opacity: [0.34, 0.34, 1, 1, 0.42, 0.34],
                      scale: [1, 1, 1.3, 1.3, 1, 1],
                      color: [
                        '#5d6267',
                        '#5d6267',
                        '#f1f1ed',
                        '#f1f1ed',
                        '#8a8f94',
                        '#5d6267',
                      ],
                    }}
                transition={stepTransition(index)}
                key={`${step}-${index}`}
              >
                <motion.b
                  data-active-accent="animated"
                  initial={reduceMotion
                    ? false
                    : {
                        color: '#72777b',
                        borderColor: '#666b70',
                        borderWidth: 2,
                      }}
                  animate={reduceMotion
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
                          '#72777b',
                          '#72777b',
                        ],
                        borderColor: [
                          '#666b70',
                          '#666b70',
                          '#2f67b2',
                          '#2f67b2',
                          '#666b70',
                          '#666b70',
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
