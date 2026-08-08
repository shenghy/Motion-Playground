import { motion, useReducedMotion, useTime, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getAudiencePollState } from './canvas/audiencePollState'
import type { AudiencePollParams, MotionComponentProps } from './types'

type PollState = ReturnType<typeof getAudiencePollState>

function useOptionMotion(state: MotionValue<PollState>, index: number) {
  return {
    opacity: useTransform(state, (value) => value.options[index]?.opacity ?? 0),
    y: useTransform(state, (value) => value.options[index]?.y ?? 0),
    borderColor: useTransform(state, (value) =>
      value.options[index]?.current ? '#2f67b2' : 'rgba(241,238,229,.28)'),
    borderWidth: useTransform(state, (value) =>
      value.options[index]?.current ? '0.14cqw' : '1px'),
    backgroundColor: useTransform(state, (value) =>
      value.options[index]?.current ? 'rgba(47,103,178,.13)' : 'rgba(5,6,7,.28)'),
    numberColor: useTransform(state, (value) =>
      value.options[index]?.current ? '#2f67b2' : '#7e858b'),
  }
}

export function AudiencePoll({
  params,
  playbackTime,
}: MotionComponentProps<AudiencePollParams>) {
  const reduceMotion = useReducedMotion()
  const clock = useTime()
  const liveState = useTransform(clock, (milliseconds) =>
    getAudiencePollState(params, milliseconds / 1000))
  const livePanelOpacity = useTransform(liveState, (state) => state.panelOpacity)
  const liveHeaderOpacity = useTransform(liveState, (state) => state.header.opacity)
  const liveHeaderY = useTransform(liveState, (state) => state.header.y)
  const liveTitleOpacity = useTransform(liveState, (state) => state.title.opacity)
  const liveTitleY = useTransform(liveState, (state) => state.title.y)
  const liveCtaOpacity = useTransform(liveState, (state) => state.cta.opacity)
  const liveCtaY = useTransform(liveState, (state) => state.cta.y)
  const liveCtaScale = useTransform(liveState, (state) => state.cta.scale)
  const optionMotion = [
    useOptionMotion(liveState, 0),
    useOptionMotion(liveState, 1),
    useOptionMotion(liveState, 2),
    useOptionMotion(liveState, 3),
  ]
  const sampled = playbackTime === undefined
    ? null
    : getAudiencePollState(params, playbackTime)
  const content = sampled ?? getAudiencePollState(params, 3.4)
  const visible = { opacity: 1, y: 0 }

  return (
    <div className="motion-canvas audience-poll" data-pencil-style="silver-on-black">
      <PencilTexture variant="grain" />
      <section
        className="audience-poll__card"
        data-testid="audience-poll-primary"
        data-zone="left-primary"
        data-outer-frame="none"
      >
        <motion.div
          aria-hidden="true"
          className="audience-poll__panel"
          data-testid="audience-poll-panel"
          style={{
            opacity: reduceMotion
              ? 1
              : sampled?.panelOpacity ?? livePanelOpacity,
          }}
        />
        <motion.span
          className="audience-poll__eyebrow"
          style={reduceMotion ? visible : sampled ? sampled.header : {
            opacity: liveHeaderOpacity, y: liveHeaderY,
          }}
        >
          {params.eyebrow || '08 / LIVE POLL'}
        </motion.span>
        <motion.h2
          className="motion-content-text"
          style={reduceMotion ? visible : sampled ? sampled.title : {
            opacity: liveTitleOpacity, y: liveTitleY,
          }}
        >
          {params.title || '请选择你的答案'}
        </motion.h2>
        <ol className="audience-poll__options">
          {content.options.map((option, index) => (
            <motion.li
              className="audience-poll__option"
              data-current={option.current}
              key={`${option.label}-${index}`}
              style={reduceMotion ? visible : sampled ? {
                opacity: option.opacity, y: option.y,
              } : {
                opacity: optionMotion[index].opacity,
                y: optionMotion[index].y,
                borderColor: optionMotion[index].borderColor,
                borderWidth: optionMotion[index].borderWidth,
                backgroundColor: optionMotion[index].backgroundColor,
              }}
            >
              <motion.b style={reduceMotion || sampled ? undefined : {
                color: optionMotion[index].numberColor,
              }}>
                {String(index + 1).padStart(2, '0')}
              </motion.b>
              <span className="motion-content-text">{option.label}</span>
            </motion.li>
          ))}
        </ol>
        <motion.p
          className="audience-poll__cta motion-content-text"
          style={reduceMotion ? { ...visible, scale: 1 } : sampled ? sampled.cta : {
            opacity: liveCtaOpacity, y: liveCtaY, scale: liveCtaScale,
          }}
        >
          {params.callToAction || '把编号打在弹幕或评论区，告诉我你的选择'}
        </motion.p>
      </section>
    </div>
  )
}
