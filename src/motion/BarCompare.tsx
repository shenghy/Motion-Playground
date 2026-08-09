import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { clampDataValue, resolveFocusIndex } from './dataMath'
import { PencilTexture } from './PencilTexture'
import { getBarCompareState } from './canvas/barCompareState'
import type { BarCompareParams, MotionComponentProps } from './types'

const ease = [0.22, 1, 0.36, 1] as const

interface BarItem {
  label: string
  value: number
}

export function BarCompare({ params, playbackTime }: MotionComponentProps<BarCompareParams>) {
  const reduceMotion = useReducedMotion()
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
  const maximum = Math.max(...values, 1)
  const sampled = playbackTime === undefined ? null : getBarCompareState(params, playbackTime)

  const oneShotTransition = (delay: number) => reduceMotion || sampled
    ? { duration: 0 }
    : {
        duration: delay + 0.65,
        times: [0, delay / (delay + 0.65), 1],
        ease,
      }

  return (
    <div
      className="motion-canvas bar-compare"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="hatch" />
      <div className="bar-compare__wash" aria-hidden="true" />

      <section
        className="bar-compare__card"
        data-testid="bar-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-pencil-layout="hatched-chart"
      >
        <motion.header
          className="data-card__heading"
          initial={reduceMotion || sampled ? false : { opacity: 0, y: 14 }}
          animate={sampled
            ? { opacity: sampled.headerOpacity, y: 14 * (1 - sampled.headerOpacity) }
            : reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 0, 1], y: [14, 14, 0] }}
          transition={oneShotTransition(0.18)}
        >
          <span>{params.eyebrow || '04 / 数据对比'}</span>
          <h2 className="motion-content-text">
            {params.title || '未命名对比'}
          </h2>
        </motion.header>

        <div className="bar-compare__plot">
          <motion.div
            className="bar-compare__baseline"
            aria-hidden="true"
            initial={reduceMotion || sampled ? false : { scaleX: 0 }}
            animate={sampled ? { scaleX: sampled.baselineReveal } : reduceMotion ? { scaleX: 1 } : { scaleX: [0, 0, 1] }}
            transition={oneShotTransition(0.48)}
          />

          {safeItems.map((item, index) => {
            const height = Math.max(12, (item.value / maximum) * 100)
            const focused = index === focusIndex

            return (
              <div
                className="bar-compare__item"
                data-testid="bar-column"
                data-focused={focused}
                data-pencil-weight={focused ? 'heavy' : 'light'}
                key={`${item.label}-${index}`}
              >
                <motion.div
                  className="bar-compare__column"
                  style={{ '--bar-height': `${height}%` } as CSSProperties}
                  initial={reduceMotion || sampled ? false : { scaleY: 0, opacity: 0 }}
                  animate={sampled
                    ? { scaleY: sampled.items[index].barReveal, opacity: sampled.items[index].barReveal }
                    : reduceMotion
                    ? { scaleY: 1, opacity: 1 }
                    : {
                        scaleY: [0, 0, 1],
                        opacity: [0, 0, 1],
                      }}
                  transition={oneShotTransition(0.72 + index * 0.14)}
                >
                  <strong>
                    {item.value}
                    <span>{params.suffix}</span>
                  </strong>
                </motion.div>
                <motion.span
                  className="bar-compare__label motion-content-text"
                  initial={reduceMotion || sampled ? false : { opacity: 0 }}
                  animate={sampled
                    ? { opacity: sampled.items[index].labelOpacity }
                    : reduceMotion
                    ? { opacity: 1 }
                    : { opacity: [0, 0, 1] }}
                  transition={oneShotTransition(1.04 + index * 0.14)}
                >
                  {item.label}
                </motion.span>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
