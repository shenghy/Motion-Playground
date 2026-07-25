import { motion, useReducedMotion } from 'motion/react'
import type { MotionComponentProps, QuoteLockupParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const

export function QuoteLockup({ params }: MotionComponentProps<QuoteLockupParams>) {
  const reduceMotion = useReducedMotion()
  const duration = reduceMotion ? 0 : params.duration * 0.42
  const alignItems = params.align === 'center' ? 'center' : 'flex-start'

  return (
    <div className="motion-canvas quote-lockup">
      <div className="canvas-grid canvas-grid--sparse" aria-hidden="true" />
      <div className="quote-lockup__rule quote-lockup__rule--top" aria-hidden="true" />
      <div className="quote-lockup__rule quote-lockup__rule--bottom" aria-hidden="true" />

      <motion.div
        className="quote-lockup__locator"
        aria-hidden="true"
        initial={{ opacity: 0, rotate: -45, scale: 0.4 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration, ease }}
      >
        <i /><i />
      </motion.div>

      <div
        className="quote-lockup__content"
        style={{ alignItems }}
        data-testid="quote-primary"
        data-zone="left-primary"
      >
        <motion.div
          className="motion-eyebrow quote-lockup__eyebrow"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration, delay: reduceMotion ? 0 : 0.12, ease }}
        >
          <span>03</span>
          {params.eyebrow || 'QUOTE / UNTITLED'}
        </motion.div>

        <motion.div
          className="quote-lockup__mark"
          aria-hidden="true"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration, delay: reduceMotion ? 0 : 0.2, ease }}
        >
          “
        </motion.div>

        <motion.blockquote
          style={{ maxWidth: `${params.maxWidth}px`, textAlign: params.align }}
          initial={{ opacity: 0, y: 56, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
          transition={{ duration: reduceMotion ? 0 : params.duration * 0.58, delay: reduceMotion ? 0 : 0.26, ease }}
        >
          {params.quote || '这里需要一句值得被记住的话。'}
        </motion.blockquote>

        <motion.div
          className="quote-lockup__underline"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 1, 0.28] }}
          transition={{ duration: reduceMotion ? 0 : params.duration * 0.7, delay: reduceMotion ? 0 : 0.48, ease }}
        />

      </div>

      <motion.aside
        className="quote-lockup__author"
        data-testid="quote-secondary"
        data-zone="right-secondary"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.62, ease }}
      >
        <i aria-hidden="true" />
        <div>
          <strong>{params.author || 'ANONYMOUS'}</strong>
          <span>{params.role || 'SOURCE UNKNOWN'}</span>
        </div>
      </motion.aside>

      <motion.div
        className="quote-lockup__status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration, delay: reduceMotion ? 0 : 0.82 }}
      >
        WORDS / LOCKED <span>●</span>
      </motion.div>
    </div>
  )
}
