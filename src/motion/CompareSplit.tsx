import { motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { CompareSplitParams, MotionComponentProps } from './types'
import { useCountUp } from './useCountUp'

const ease = [0.22, 1, 0.36, 1] as const

export function CompareSplit({ params }: MotionComponentProps<CompareSplitParams>) {
  const reduceMotion = useReducedMotion()
  const leftValue = useCountUp(params.leftValue, params.duration, 0)
  const rightValue = useCountUp(params.rightValue, params.duration, 0)
  const duration = reduceMotion ? 0 : params.duration * 0.45
  const split = Math.min(68, Math.max(32, params.split))
  const primaryWidth = 27 + ((split - 32) / 36) * 7

  return (
    <div
      className="motion-canvas compare-split"
      style={{ '--primary-width': `${primaryWidth}%` } as CSSProperties}
    >
      <div className="canvas-grid" aria-hidden="true" />
      <motion.header
        className="compare-split__header"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.12, ease }}
      >
        <span>02 / 对比研究</span>
        <h2>{params.title || '未命名对比'}</h2>
        <span>双项对比</span>
      </motion.header>

      <div className="compare-split__panels">
        <motion.section
          className="compare-panel compare-panel--left"
          data-testid="compare-left"
          data-emphasized={params.emphasis === 'left'}
          data-zone="left-primary"
          initial={{ opacity: 0, x: -90, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }}
          transition={{ duration, delay: reduceMotion ? 0 : 0.1, ease }}
        >
          <span className="compare-panel__index">方案甲 / 01</span>
          <div className="compare-panel__content">
            <span className="compare-panel__label">{params.leftLabel || '左侧'}</span>
            <strong>
              {leftValue}<em>{params.suffix}</em>
            </strong>
            <span className="compare-panel__baseline">基准 / 参考</span>
          </div>
          <div className="compare-panel__meter" aria-hidden="true">
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0.08, params.leftValue / 100) }}
              transition={{ duration, delay: reduceMotion ? 0 : 0.36, ease }}
            />
          </div>
        </motion.section>

        <motion.section
          className="compare-panel compare-panel--right"
          data-testid="compare-right"
          data-emphasized={params.emphasis === 'right'}
          data-zone="right-secondary"
          initial={{ opacity: 0, x: 90, clipPath: 'inset(0 0 0 100%)' }}
          animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0 0 0%)' }}
          transition={{ duration, delay: reduceMotion ? 0 : 0.22, ease }}
        >
          <span className="compare-panel__index">方案乙 / 02</span>
          <div className="compare-panel__content">
            <span className="compare-panel__label">{params.rightLabel || '右侧'}</span>
            <strong>
              {rightValue}<em>{params.suffix}</em>
            </strong>
            <span className="compare-panel__baseline">当前 / 已优化</span>
          </div>
          <div className="compare-panel__meter" aria-hidden="true">
            <motion.i
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0.08, params.rightValue / 100) }}
              transition={{ duration, delay: reduceMotion ? 0 : 0.48, ease }}
            />
          </div>
        </motion.section>
      </div>

      <motion.footer
        className="compare-split__result"
        data-testid="compare-result"
        data-safe-motion="upward"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.62, ease }}
      >
        <span>结论 / 已锁定</span>
        <strong>{params.conclusion || '暂无结论'}</strong>
        <span>可信度 98.4</span>
      </motion.footer>
    </div>
  )
}
