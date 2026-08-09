import { useRef } from 'react'
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useTime,
  useTransform,
} from 'motion/react'
import type { MotionStyle, MotionValue } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getCompareSplitState } from './canvas/compareSplitState'
import type { CompareSplitParams, MotionComponentProps } from './types'

type CompareStyle = MotionStyle & Record<
  `--${string}`,
  string | number | MotionValue<string | number>
>

function meterScale(value: number) {
  if (!Number.isFinite(value)) return 0.08
  return Math.max(0.08, Math.min(1, value / 100))
}

export function CompareSplit({
  params,
  playbackTime,
}: MotionComponentProps<CompareSplitParams>) {
  const reduceMotion = useReducedMotion()
  const clock = useTime()
  const upperValueRef = useRef<HTMLSpanElement>(null)
  const lowerValueRef = useRef<HTMLSpanElement>(null)
  const stableTime = Math.max(2.4, params.duration + 0.6)
  const stable = getCompareSplitState(params, stableTime)
  const sampled = playbackTime === undefined
    ? null
    : getCompareSplitState(params, playbackTime)
  const content = reduceMotion ? stable : sampled ?? getCompareSplitState(params, 0)
  const liveState = useTransform(clock, (milliseconds) =>
    getCompareSplitState(params, milliseconds / 1000))
  const livePanelOpacity = useTransform(liveState, (state) => state.panelOpacity)
  const liveHeaderOpacity = useTransform(liveState, (state) => state.headerOpacity)
  const liveUpperOpacity = useTransform(liveState, (state) => state.upperOpacity)
  const liveLowerOpacity = useTransform(liveState, (state) => state.lowerOpacity)
  const liveScanProgress = useTransform(liveState, (state) => state.scanProgress)
  const liveScanTop = useTransform(
    liveState,
    (state) => `${state.verticalSplit * state.scanProgress}%`,
  )
  const liveLowerHighlight = useTransform(liveState, (state) => state.lowerHighlight)
  const liveResultOpacity = useTransform(liveState, (state) => state.resultOpacity)
  const liveMode = !reduceMotion && sampled === null

  useMotionValueEvent(liveState, 'change', (state) => {
    if (!liveMode) return
    if (upperValueRef.current) upperValueRef.current.textContent = state.upperValue
    if (lowerValueRef.current) lowerValueRef.current.textContent = state.lowerValue
  })

  const animated = <T,>(stableValue: T, sampledValue: T, liveValue: MotionValue<T>) => (
    reduceMotion ? stableValue : sampled ? sampledValue : liveValue
  )
  const suffix = params.suffix || '%'

  return (
    <div
      className="motion-canvas compare-split"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="eraser" />
      <div className="canvas-grid" aria-hidden="true" />

      <motion.section
        className="compare-split__card"
        data-testid="compare-card"
        data-zone="left-primary"
        style={{
          '--compare-split': `${content.verticalSplit}%`,
          opacity: animated(
            stable.panelOpacity,
            sampled?.panelOpacity ?? content.panelOpacity,
            livePanelOpacity,
          ),
        } as CompareStyle}
      >
        <motion.header
          className="compare-split__header"
          style={{
            opacity: animated(
              stable.headerOpacity,
              sampled?.headerOpacity ?? content.headerOpacity,
              liveHeaderOpacity,
            ),
          }}
        >
          <span>03 / 对比研究</span>
          <h2 className="motion-content-text">
            {params.title || '未命名对比'}
          </h2>
        </motion.header>

        <div className="compare-split__tracks">
          <motion.article
            className="compare-track compare-track--upper"
            data-testid="compare-upper"
            data-emphasized={content.emphasis === 'left'}
            style={{
              '--meter-scale': meterScale(params.leftValue),
              opacity: animated(
                stable.upperOpacity,
                sampled?.upperOpacity ?? content.upperOpacity,
                liveUpperOpacity,
              ),
            } as CompareStyle}
          >
            <span className="compare-track__index">基准 / 01</span>
            <div className="compare-track__reading">
              <span className="compare-track__label motion-content-text">
                {params.leftLabel || '优化前'}
              </span>
              <strong>
                <span ref={upperValueRef}>{content.upperValue}</span>
                <em>{suffix}</em>
              </strong>
            </div>
            <i className="compare-track__meter" aria-hidden="true" />
          </motion.article>

          <motion.i
            className="compare-split__scan"
            data-testid="compare-scan"
            aria-hidden="true"
            style={{
              top: animated(
                `${stable.verticalSplit * stable.scanProgress}%`,
                `${content.verticalSplit * content.scanProgress}%`,
                liveScanTop,
              ),
              opacity: animated(
                stable.scanProgress,
                sampled?.scanProgress ?? content.scanProgress,
                liveScanProgress,
              ),
            }}
          />

          <motion.article
            className="compare-track compare-track--lower"
            data-testid="compare-lower"
            data-emphasized={content.emphasis === 'right'}
            style={{
              '--meter-scale': meterScale(params.rightValue),
              '--highlight': animated(
                stable.lowerHighlight,
                sampled?.lowerHighlight ?? content.lowerHighlight,
                liveLowerHighlight,
              ),
              opacity: animated(
                stable.lowerOpacity,
                sampled?.lowerOpacity ?? content.lowerOpacity,
                liveLowerOpacity,
              ),
            } as CompareStyle}
          >
            <span className="compare-track__index">结果 / 02</span>
            <div className="compare-track__reading">
              <span className="compare-track__label motion-content-text">
                {params.rightLabel || '优化后'}
              </span>
              <strong>
                <span ref={lowerValueRef}>{content.lowerValue}</span>
                <em>{suffix}</em>
              </strong>
            </div>
            <i className="compare-track__meter" aria-hidden="true" />
          </motion.article>
        </div>

        <motion.footer
          className="compare-split__result"
          data-testid="compare-result"
          data-zone="left-primary"
          data-safe-motion="upward"
          style={{
            opacity: animated(
              stable.resultOpacity,
              sampled?.resultOpacity ?? content.resultOpacity,
              liveResultOpacity,
            ),
          }}
        >
          <span>结论 / 已锁定</span>
          <strong className="motion-content-text">
            {params.conclusion || '暂无结论'}
          </strong>
        </motion.footer>
      </motion.section>
    </div>
  )
}
