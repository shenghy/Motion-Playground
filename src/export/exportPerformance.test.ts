import { describe, expect, it } from 'vitest'
import { createExportPerformance } from './exportPerformance'

describe('export performance', () => {
  it('does not invent speed or ETA before the first completed frame', () => {
    let now = 1_000
    const performance = createExportPerformance(() => now)

    now = 1_250

    expect(performance.snapshot()).toEqual({
      completedFrames: 0,
      totalFrames: 0,
      elapsedMs: 250,
      framesPerSecond: null,
      estimatedRemainingMs: null,
      phases: {
        preparing: 0,
        framePrepare: 0,
        frameCapture: 0,
        frameTransfer: 0,
        encoding: 0,
        saving: 0,
      },
    })
  })

  it('calculates average speed, ETA, and phase totals from a monotonic clock', () => {
    let now = 1_000
    const performance = createExportPerformance(() => now)

    performance.addDuration('frameCapture', 120)
    performance.addDuration('frameCapture', 30)
    performance.addDuration('frameTransfer', 20)
    now = 1_200
    performance.completeFrame(1, 3)

    expect(performance.snapshot()).toMatchObject({
      completedFrames: 1,
      totalFrames: 3,
      elapsedMs: 200,
      framesPerSecond: 5,
      estimatedRemainingMs: 400,
      phases: {
        frameCapture: 150,
        frameTransfer: 20,
      },
    })
  })

  it('clamps invalid durations and frame counts', () => {
    const performance = createExportPerformance(() => 100)

    performance.addDuration('encoding', -20)
    performance.addDuration('saving', Number.NaN)
    performance.completeFrame(-1, -2)

    expect(performance.snapshot()).toMatchObject({
      completedFrames: 0,
      totalFrames: 0,
      phases: { encoding: 0, saving: 0 },
    })
  })
})
