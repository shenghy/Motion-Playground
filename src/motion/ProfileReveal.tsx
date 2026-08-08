import { motion, useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
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
    <div
      className="motion-canvas profile-reveal"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="grain" />
      <div className="profile-reveal__shade" aria-hidden="true" />

      <motion.section
        className="profile-reveal__card"
        data-testid="profile-primary"
        data-outer-frame="none"
        data-zone="left-primary"
        data-pencil-layout="field-note"
        {...reveal(0.08, 0)}
      >
        <motion.header className="profile-reveal__identity" {...reveal(0.38)}>
          <i aria-hidden="true" />
          <div>
            <strong>{params.category || '人物 / 档案'}</strong>
            <span>{params.descriptor || '人物身份说明'}</span>
          </div>
        </motion.header>

        <motion.div className="profile-reveal__title" {...reveal(0.86)}>
          <span>{params.overline || '人物故事'}</span>
          <h2 className="motion-content-text">
            {params.title || '未命名人物'}
          </h2>
        </motion.div>

        <div className="profile-reveal__facts">
          {facts.map((fact, index) => (
            <motion.div
              className="profile-reveal__fact"
              key={`${index}-${fact.text}`}
              {...reveal(1.58 + index * 0.68)}
            >
              <motion.b
                className="profile-reveal__check"
                data-testid="profile-check"
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: -2 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.35,
                  delay: reduceMotion ? 0 : 1.72 + index * 0.68,
                  ease,
                }}
              >
                ✓
              </motion.b>
              <div>
                <strong className="motion-content-text">
                  {fact.text || `信息 ${index + 1}`}
                </strong>
                <span>{fact.note || '详情待补充'}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.footer className="profile-reveal__card-footer" {...reveal(3.7, 8)}>
          <span>叙事 / 03</span>
          <i aria-hidden="true" />
          <span>自动呈现</span>
        </motion.footer>
      </motion.section>

    </div>
  )
}
