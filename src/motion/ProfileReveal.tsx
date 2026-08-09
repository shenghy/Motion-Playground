import { motion, useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getProfileRevealState } from './canvas/profileRevealState'
import type { MotionComponentProps, ProfileRevealParams } from './types'

const ease = [0.22, 1, 0.36, 1] as const

interface Fact {
  text: string
  note: string
}

export function ProfileReveal({ params, playbackTime }: MotionComponentProps<ProfileRevealParams>) {
  const reduceMotion = useReducedMotion()
  const sampled = playbackTime === undefined
    ? null
    : getProfileRevealState(params, playbackTime)

  const reveal = (start: number, distance = 18, sampledLayer?: { opacity: number; y: number }) => {
    if (reduceMotion) {
      return {
        initial: false as const,
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      }
    }

    if (sampledLayer) {
      return {
        initial: false as const,
        animate: { opacity: sampledLayer.opacity, y: sampledLayer.y },
        transition: { duration: 0 },
      }
    }

    return {
      initial: { opacity: 0, y: distance },
      animate: {
        opacity: [0, 0, 1],
        y: [distance, distance, 0],
      },
      transition: {
        duration: Math.max(0.01, start + 0.38),
        times: [0, start / (start + 0.38), 1],
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
        {...reveal(0.08, 0, sampled?.card)}
      >
        <motion.header className="profile-reveal__identity" {...reveal(0.38, 18, sampled?.identity)}>
          <i aria-hidden="true" />
          <div>
            <strong>{params.category || '人物 / 档案'}</strong>
            <span>{params.descriptor || '人物身份说明'}</span>
          </div>
        </motion.header>

        <motion.div className="profile-reveal__title" {...reveal(0.86, 18, sampled?.title)}>
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
              {...reveal(1.58 + index * 0.68, 18, sampled?.facts[index])}
            >
              <motion.b
                className="profile-reveal__check"
                data-testid="profile-check"
                aria-hidden="true"
                initial={sampled ? false : { opacity: 0, scale: 0.7, rotate: -8 }}
                animate={sampled
                  ? { opacity: sampled.facts[index].opacity, scale: 0.7 + sampled.facts[index].opacity * 0.3, rotate: -2 }
                  : { opacity: 1, scale: 1, rotate: -2 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.35,
                  delay: reduceMotion || sampled ? 0 : 1.72 + index * 0.68,
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

        <motion.footer className="profile-reveal__card-footer" {...reveal(3.7, 8, sampled?.footer)}>
          <span>叙事 / 03</span>
          <i aria-hidden="true" />
          <span>自动呈现</span>
        </motion.footer>
      </motion.section>

    </div>
  )
}
