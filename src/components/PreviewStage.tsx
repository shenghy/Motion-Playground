import { CompareSplit } from '../motion/CompareSplit'
import { MetricFocus } from '../motion/MetricFocus'
import { QuoteLockup } from '../motion/QuoteLockup'
import type {
  CompareSplitParams,
  MetricFocusParams,
  MotionId,
  ParameterValues,
  QuoteLockupParams,
} from '../motion/types'

interface PreviewStageProps {
  motionId: MotionId
  motionName: string
  params: ParameterValues
  playbackKey: number
  showSafeArea: boolean
}

function renderMotion(id: MotionId, params: ParameterValues) {
  switch (id) {
    case 'compare-split':
      return <CompareSplit params={params as CompareSplitParams} />
    case 'quote-lockup':
      return <QuoteLockup params={params as QuoteLockupParams} />
    default:
      return <MetricFocus params={params as MetricFocusParams} />
  }
}

export function PreviewStage({
  motionId,
  motionName,
  params,
  playbackKey,
  showSafeArea,
}: PreviewStageProps) {
  return (
    <main className="preview-stage">
      <div className="stage-heading">
        <div>
          <span className="section-index">STAGE / 02</span>
          <h2>{motionName}</h2>
        </div>
        <div className="stage-heading__meta">
          <span>1920 × 1080</span>
          <span>60 FPS</span>
          <span className="loop-status"><i /> LOOP</span>
        </div>
      </div>

      <div className="stage-viewport">
        <div className="stage-ruler stage-ruler--top" aria-hidden="true">
          {Array.from({ length: 13 }, (_, index) => <i key={index} />)}
        </div>
        <div className="stage-ruler stage-ruler--left" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
        <div
          className="preview-canvas"
          data-testid="preview-stage"
          data-playback-key={playbackKey}
        >
          <img
            className="presenter-background"
            src="/reference-standing.png"
            alt="口播人物参考背景"
          />
          <div className="motion-slot" key={`${motionId}-${playbackKey}`}>
            {renderMotion(motionId, params)}
          </div>
          {showSafeArea && (
            <div
              className="presenter-safe-area"
              data-testid="presenter-safe-area"
              aria-hidden="true"
            >
              <span>PERSON / SAFE AREA</span>
              <i /><i /><i /><i />
            </div>
          )}
        </div>
      </div>

      <div className="stage-footer">
        <span>COLOR / MONO</span>
        <span>AUTO PLAY · INFINITE LOOP</span>
        <span>ZOOM / FIT</span>
      </div>
    </main>
  )
}
