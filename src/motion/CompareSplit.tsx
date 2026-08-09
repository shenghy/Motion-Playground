import type { CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import { PencilTexture } from './PencilTexture'
import { getCompareSplitState } from './canvas/compareSplitState'
import type { CompareSplitParams, MotionComponentProps } from './types'

type CompareStyle = CSSProperties & Record<`--${string}`, string | number>

function meterScale(value: number) {
  if (!Number.isFinite(value)) return 0.08
  return Math.max(0.08, Math.min(1, value / 100))
}

export function CompareSplit({
  params,
  playbackTime = 0,
}: MotionComponentProps<CompareSplitParams>) {
  const reduceMotion = useReducedMotion()
  const stableTime = Math.max(2.4, params.duration + 0.6)
  const state = getCompareSplitState(
    params,
    reduceMotion ? stableTime : playbackTime,
  )
  const suffix = params.suffix || '%'

  return (
    <div
      className="motion-canvas compare-split"
      data-pencil-style="silver-on-black"
    >
      <PencilTexture variant="eraser" />
      <div className="canvas-grid" aria-hidden="true" />

      <section
        className="compare-split__card"
        data-testid="compare-card"
        data-zone="left-primary"
        style={{
          '--compare-split': `${state.verticalSplit}%`,
          opacity: state.panelOpacity,
        } as CompareStyle}
      >
        <header
          className="compare-split__header"
          style={{ opacity: state.headerOpacity }}
        >
          <span>03 / 对比研究</span>
          <h2 className="motion-content-text">
            {params.title || '未命名对比'}
          </h2>
        </header>

        <div className="compare-split__tracks">
          <article
            className="compare-track compare-track--upper"
            data-testid="compare-upper"
            data-emphasized={state.emphasis === 'left'}
            style={{
              '--meter-scale': meterScale(params.leftValue),
              opacity: state.upperOpacity,
            } as CompareStyle}
          >
            <span className="compare-track__index">基准 / 01</span>
            <div className="compare-track__reading">
              <span className="compare-track__label motion-content-text">
                {params.leftLabel || '优化前'}
              </span>
              <strong>
                {state.upperValue}
                <em>{suffix}</em>
              </strong>
            </div>
            <i className="compare-track__meter" aria-hidden="true" />
          </article>

          <i
            className="compare-split__scan"
            data-testid="compare-scan"
            aria-hidden="true"
            style={{
              top: `${state.verticalSplit * state.scanProgress}%`,
              opacity: state.scanProgress,
            }}
          />

          <article
            className="compare-track compare-track--lower"
            data-testid="compare-lower"
            data-emphasized={state.emphasis === 'right'}
            style={{
              '--meter-scale': meterScale(params.rightValue),
              '--highlight': state.lowerHighlight,
              opacity: state.lowerOpacity,
            } as CompareStyle}
          >
            <span className="compare-track__index">结果 / 02</span>
            <div className="compare-track__reading">
              <span className="compare-track__label motion-content-text">
                {params.rightLabel || '优化后'}
              </span>
              <strong>
                {state.lowerValue}
                <em>{suffix}</em>
              </strong>
            </div>
            <i className="compare-track__meter" aria-hidden="true" />
          </article>
        </div>

        <footer
          className="compare-split__result"
          data-testid="compare-result"
          data-zone="left-primary"
          data-safe-motion="upward"
          style={{ opacity: state.resultOpacity }}
        >
          <span>结论 / 已锁定</span>
          <strong className="motion-content-text">
            {params.conclusion || '暂无结论'}
          </strong>
        </footer>
      </section>
    </div>
  )
}
