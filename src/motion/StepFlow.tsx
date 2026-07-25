import { motion, useReducedMotion } from 'motion/react'
import { resolveFocusIndex } from './dataMath'
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
  ]
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 5)
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
    <div className="motion-canvas step-flow">
      <div className="step-flow__wash" aria-hidden="true" />

      <section
        className="step-flow__card"
        data-testid="flow-primary"
        data-zone="left-primary"
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
          <span>{params.eyebrow || '06 / PROCESS MAP'}</span>
          <h2>{params.title || '未命名流程'}</h2>
        </motion.header>

        <div className="step-flow__steps">
          <motion.div
            className="step-flow__connector"
            aria-hidden="true"
            initial={reduceMotion ? false : { scaleY: 0 }}
            animate={reduceMotion ? { scaleY: 1 } : { scaleY: [0, 1, 1, 0] }}
            transition={reduceMotion
              ? { duration: 0 }
              : {
                  duration: cycle,
                  times: [0, 0.12, 0.9, 1],
                  repeat: Infinity,
                  repeatDelay: 0.72,
                  ease,
                }}
          />

          {steps.map((step, index) => {
            const initialFocus = index === focusIndex
            const staticOpacity = initialFocus ? 1 : 0.42

            return (
              <motion.div
                className="step-flow__step"
                data-testid="flow-step"
                data-initial-focus={initialFocus}
                initial={reduceMotion ? false : { opacity: 0.34, scale: 1 }}
                animate={reduceMotion
                  ? { opacity: staticOpacity, scale: initialFocus ? 1.08 : 1 }
                  : {
                      opacity: [0.34, 0.34, 1, 1, 0.42, 0.34],
                      scale: [1, 1, 1.08, 1.08, 1, 1],
                    }}
                transition={stepTransition(index)}
                key={`${step}-${index}`}
              >
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span>{step}</span>
                <i aria-hidden="true" />
              </motion.div>
            )
          })}
        </div>
      </section>

      <aside
        className="step-flow__status data-result"
        data-testid="flow-secondary"
        data-zone="right-secondary"
      >
        <span>{params.statusLabel || 'CURRENT'}</span>
        <div className="step-flow__status-numbers" aria-hidden="true">
          {steps.map((_, index) => (
            <motion.strong
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion
                ? { opacity: index === focusIndex ? 1 : 0, y: 0 }
                : {
                    opacity: [0, 0, 1, 1, 0, 0],
                    y: [12, 12, 0, 0, -8, -8],
                  }}
              transition={stepTransition(index)}
              key={index}
            >
              {String(index + 1).padStart(2, '0')}
            </motion.strong>
          ))}
        </div>
        <i aria-hidden="true" />
        <small>{params.statusNote || steps[focusIndex]}</small>
      </aside>
    </div>
  )
}
