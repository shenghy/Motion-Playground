import { motion, useReducedMotion } from 'motion/react'
import { normalizeShares, resolveFocusIndex } from './dataMath'
import type { MotionComponentProps, ShareRingParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const
const radius = 42
const circumference = 2 * Math.PI * radius
const segmentGap = 2.4

interface ShareItem {
  label: string
  value: number
  percentage: number
}

export function ShareRing({ params }: MotionComponentProps<ShareRingParams>) {
  const reduceMotion = useReducedMotion()
  const cycle = Math.min(10, Math.max(5, params.duration))
  const sourceItems = [
    { label: params.item1Label, value: params.item1Value },
    { label: params.item2Label, value: params.item2Value },
    { label: params.item3Label, value: params.item3Value },
    { label: params.item4Label, value: params.item4Value },
  ]
    .filter((item) => item.label.trim())
    .slice(0, 4)

  const safeItems = sourceItems.length >= 2
    ? sourceItems
    : [
        { label: 'PRIMARY', value: 68 },
        { label: 'OTHER', value: 32 },
      ]
  const percentages = normalizeShares(safeItems.map((item) => item.value))
  const items: ShareItem[] = safeItems.map((item, index) => ({
    ...item,
    percentage: percentages[index],
  }))
  const focusIndex = resolveFocusIndex(
    items.map((item) => item.value),
    params.focusIndex,
  )
  const focusItem = items[focusIndex]
  const focusPercentage = Math.round(focusItem.percentage)

  let accumulatedPercentage = 0

  const loopTransition = (delay: number) => reduceMotion
    ? { duration: 0 }
    : {
        duration: cycle,
        times: [0, delay / cycle, (delay + 0.72) / cycle, (cycle - 0.6) / cycle, 1],
        repeat: Infinity,
        repeatDelay: 0.75,
        ease,
      }

  return (
    <div className="motion-canvas share-ring">
      <div className="share-ring__wash" aria-hidden="true" />

      <section
        className="share-ring__card"
        data-testid="share-primary"
        data-zone="left-primary"
      >
        <motion.header
          className="data-card__heading"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={reduceMotion
            ? { opacity: 1, y: 0 }
            : { opacity: [0, 0, 1, 1, 0], y: [14, 14, 0, 0, -5] }}
          transition={loopTransition(0.16)}
        >
          <span>{params.eyebrow || '05 / SHARE ANALYSIS'}</span>
          <h2>{params.title || '未命名占比'}</h2>
        </motion.header>

        <div className="share-ring__visual">
          <svg viewBox="0 0 100 100" role="img" aria-label={`${focusItem.label} ${focusPercentage}%`}>
            <circle className="share-ring__track" cx="50" cy="50" r={radius} />
            <g transform="rotate(-90 50 50)">
              {items.map((item, index) => {
                const offset = circumference * accumulatedPercentage / 100
                const length = circumference * item.percentage / 100
                accumulatedPercentage += item.percentage
                const focused = index === focusIndex
                const finalDash = `${Math.max(0, length - segmentGap)} ${circumference}`

                return (
                  <motion.circle
                    className={`share-ring__segment share-ring__segment--${index + 1}`}
                    data-testid="share-segment"
                    data-segment-index={index + 1}
                    data-focused={focused}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeDashoffset={-offset}
                    strokeWidth={focused ? 11 : Math.max(5, 9 - index)}
                    initial={reduceMotion
                      ? false
                      : { strokeDasharray: `0 ${circumference}`, opacity: 0 }}
                    animate={reduceMotion
                      ? { strokeDasharray: finalDash, opacity: 1 }
                      : {
                          strokeDasharray: [
                            `0 ${circumference}`,
                            `0 ${circumference}`,
                            finalDash,
                            finalDash,
                            `0 ${circumference}`,
                          ],
                          opacity: [0, 0, 1, 1, 0],
                        }}
                    transition={loopTransition(0.5 + index * 0.2)}
                    key={`${item.label}-${index}`}
                  />
                )
              })}
            </g>
          </svg>

          <motion.div
            className="share-ring__center"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={reduceMotion
              ? { opacity: 1, scale: 1 }
              : {
                  opacity: [0, 0, 1, 1, 0],
                  scale: [0.9, 0.9, 1, 1, 0.96],
                }}
            transition={loopTransition(1.55)}
          >
            <strong data-testid="share-center-value">{focusPercentage}%</strong>
            <span>{params.centerLabel || focusItem.label}</span>
          </motion.div>
        </div>

        <div className="share-ring__legend">
          {items.map((item, index) => (
            <motion.div
              data-focused={index === focusIndex}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: [0, 0, 1, 1, 0], y: [8, 8, 0, 0, -3] }}
              transition={loopTransition(1.72 + index * 0.12)}
              key={`${item.label}-legend`}
            >
              <span>{item.label}</span>
              <strong>{Math.round(item.percentage)}%</strong>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.aside
        className="share-ring__result data-result"
        data-testid="share-secondary"
        data-zone="right-secondary"
        initial={reduceMotion ? false : { opacity: 0, x: 22 }}
        animate={reduceMotion
          ? { opacity: 1, x: 0 }
          : { opacity: [0, 0, 1, 1, 0], x: [22, 22, 0, 0, 8] }}
        transition={loopTransition(2.35)}
      >
        <span>{params.resultLabel || 'SHARE'}</span>
        <strong>{focusPercentage}<em>%</em></strong>
        <i aria-hidden="true" />
        <small>{params.resultNote || focusItem.label}</small>
      </motion.aside>
    </div>
  )
}
