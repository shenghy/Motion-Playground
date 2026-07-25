import { motion, useReducedMotion } from 'motion/react'
import type { MotionComponentProps, ProfileRevealParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const

interface Fact {
  text: string
  note: string
}

export function ProfileReveal({ params }: MotionComponentProps<ProfileRevealParams>) {
  const reduceMotion = useReducedMotion()
  const cycle = Math.min(10, Math.max(5.2, params.duration))

  const reveal = (start: number, distance = 18) => {
    if (reduceMotion) {
      return {
        initial: false as const,
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      }
    }

    const enterEnd = Math.min(0.82, (start + 0.38) / cycle)
    const exitStart = Math.max(enterEnd + 0.04, (cycle - 0.58) / cycle)

    return {
      initial: { opacity: 0, y: distance },
      animate: {
        opacity: [0, 0, 1, 1, 0],
        y: [distance, distance, 0, 0, -6],
      },
      transition: {
        duration: cycle,
        times: [0, start / cycle, enterEnd, exitStart, 1],
        repeat: Infinity,
        repeatDelay: 0.72,
        ease,
      },
    }
  }

  const facts: Fact[] = [
    { text: params.fact1, note: params.fact1Note },
    { text: params.fact2, note: params.fact2Note },
    { text: params.fact3, note: params.fact3Note },
  ]

  return (
    <div className="motion-canvas profile-reveal">
      <div className="profile-reveal__shade" aria-hidden="true" />

      <motion.section
        className="profile-reveal__card"
        data-testid="profile-primary"
        data-zone="left-primary"
        {...reveal(0.08, 0)}
      >
        <motion.header className="profile-reveal__identity" {...reveal(0.38)}>
          <i aria-hidden="true" />
          <div>
            <strong>{params.category || 'PROFILE / FIELD NOTE'}</strong>
            <span>{params.descriptor || '人物身份说明'}</span>
          </div>
        </motion.header>

        <motion.div className="profile-reveal__title" {...reveal(0.86)}>
          <span>{params.overline || 'STORY SIGNAL'}</span>
          <h2>{params.title || '未命名人物'}</h2>
        </motion.div>

        <div className="profile-reveal__facts">
          {facts.map((fact, index) => (
            <motion.div
              className="profile-reveal__fact"
              key={`${index}-${fact.text}`}
              {...reveal(1.58 + index * 0.68)}
            >
              <b aria-hidden="true">×</b>
              <div>
                <strong>{fact.text || `信息 ${index + 1}`}</strong>
                <span>{fact.note || 'DETAIL / PENDING'}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.footer className="profile-reveal__card-footer" {...reveal(3.7, 8)}>
          <span>STORY / 03</span>
          <i aria-hidden="true" />
          <span>AUTO REVEAL</span>
        </motion.footer>
      </motion.section>

      <motion.aside
        className="profile-reveal__rail"
        data-testid="profile-secondary"
        data-zone="right-secondary"
        data-safe-motion="upward"
        {...reveal(3.28, -24)}
      >
        <span className="profile-reveal__rail-index">03</span>
        <div className="profile-reveal__rail-track" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
        <strong>{params.status || 'PROFILE / VERIFIED'}</strong>
        <small>SEQUENCE<br />LOCKED</small>
      </motion.aside>
    </div>
  )
}
