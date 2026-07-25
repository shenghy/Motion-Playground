import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { clampDataValue, resolveFocusIndex } from './dataMath'
import type { BarCompareParams, MotionComponentProps } from './types'

const ease = [0.22, 1, 0.36, 1] as const

interface BarItem {
  label: string
  value: number
}

export function BarCompare({ params }: MotionComponentProps<BarCompareParams>) {
  const reduceMotion = useReducedMotion()
  const cycle = Math.min(10, Math.max(4.8, params.duration))
  const items: BarItem[] = [
    { label: params.item1Label, value: params.item1Value },
    { label: params.item2Label, value: params.item2Value },
    { label: params.item3Label, value: params.item3Value },
    { label: params.item4Label, value: params.item4Value },
  ]
    .filter((item) => item.label.trim())
    .slice(0, 4)
    .map((item) => ({
      ...item,
      value: clampDataValue(item.value, 9999),
    }))

  const safeItems = items.length >= 2
    ? items
    : [
        { label: 'A', value: 42 },
        { label: 'B', value: 86 },
      ]
  const values = safeItems.map((item) => item.value)
  const focusIndex = resolveFocusIndex(values, params.focusIndex)
  const focusItem = safeItems[focusIndex]
  const maximum = Math.max(...values, 1)

  const loopTransition = (delay: number) => reduceMotion
    ? { duration: 0 }
    : {
        duration: cycle,
        times: [0, delay / cycle, (delay + 0.65) / cycle, (cycle - 0.55) / cycle, 1],
        repeat: Infinity,
        repeatDelay: 0.7,
        ease,
      }

  return (
    <div className="motion-canvas bar-compare">
      <div className="bar-compare__wash" aria-hidden="true" />

      <section
        className="bar-compare__card"
        data-testid="bar-primary"
        data-zone="left-primary"
      >
        <motion.header
          className="data-card__heading"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 0, 1, 1, 0], y: [14, 14, 0, 0, -5] }}
          transition={loopTransition(0.18)}
        >
          <span>{params.eyebrow || '04 / DATA COMPARISON'}</span>
          <h2>{params.title || '未命名对比'}</h2>
        </motion.header>

        <div className="bar-compare__plot">
          <motion.div
            className="bar-compare__baseline"
            aria-hidden="true"
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={reduceMotion ? { scaleX: 1 } : { scaleX: [0, 0, 1, 1, 0] }}
            transition={loopTransition(0.48)}
          />

          {safeItems.map((item, index) => {
            const height = Math.max(12, (item.value / maximum) * 100)
            const focused = index === focusIndex

            return (
              <div
                className="bar-compare__item"
                data-testid="bar-column"
                data-focused={focused}
                key={`${item.label}-${index}`}
              >
                <motion.div
                  className="bar-compare__column"
                  style={{ '--bar-height': `${height}%` } as CSSProperties}
                  initial={reduceMotion ? false : { scaleY: 0, opacity: 0 }}
                  animate={reduceMotion
                    ? { scaleY: 1, opacity: 1 }
                    : {
                        scaleY: [0, 0, 1, 1, 0],
                        opacity: [0, 0, 1, 1, 0],
                      }}
                  transition={loopTransition(0.72 + index * 0.14)}
                >
                  <strong>
                    {item.value}
                    <span>{params.suffix}</span>
                  </strong>
                </motion.div>
                <motion.span
                  className="bar-compare__label"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={reduceMotion
                    ? { opacity: 1 }
                    : { opacity: [0, 0, 1, 1, 0] }}
                  transition={loopTransition(1.04 + index * 0.14)}
                >
                  {item.label}
                </motion.span>
              </div>
            )
          })}
        </div>
      </section>

      <motion.aside
        className="bar-compare__result data-result"
        data-testid="bar-secondary"
        data-zone="right-secondary"
        initial={reduceMotion ? false : { opacity: 0, x: 22 }}
        animate={reduceMotion
          ? { opacity: 1, x: 0 }
          : { opacity: [0, 0, 1, 1, 0], x: [22, 22, 0, 0, 8] }}
        transition={loopTransition(2.05)}
      >
        <span>{params.resultLabel || 'PEAK'}</span>
        <strong>{focusItem.value}{params.suffix}</strong>
        <i aria-hidden="true" />
        <small>{params.resultNote || focusItem.label}</small>
      </motion.aside>
    </div>
  )
}
