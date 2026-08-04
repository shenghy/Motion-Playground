export const EXPORT_PERFORMANCE_PHASES = [
  'preparing',
  'framePrepare',
  'frameCapture',
  'frameTransfer',
  'encoding',
  'saving',
] as const

export type ExportPerformancePhase =
  (typeof EXPORT_PERFORMANCE_PHASES)[number]

export interface ExportPerformanceSnapshot {
  completedFrames: number
  totalFrames: number
  elapsedMs: number
  framesPerSecond: number | null
  estimatedRemainingMs: number | null
  phases: Record<ExportPerformancePhase, number>
}

function safeNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createExportPerformance(
  now: () => number = () => performance.now(),
) {
  let startedAt: number | null = null
  const phases = Object.fromEntries(
    EXPORT_PERFORMANCE_PHASES.map((phase) => [phase, 0]),
  ) as Record<ExportPerformancePhase, number>
  let completedFrames = 0
  let totalFrames = 0

  return {
    addDuration(phase: ExportPerformancePhase, durationMs: number) {
      startedAt ??= now()
      phases[phase] += safeNonNegative(durationMs)
    },
    async measure<T>(
      phase: ExportPerformancePhase,
      operation: () => Promise<T>,
    ) {
      const phaseStartedAt = now()
      startedAt ??= phaseStartedAt
      try {
        return await operation()
      } finally {
        phases[phase] += safeNonNegative(now() - phaseStartedAt)
      }
    },
    completeFrame(completed: number, total: number) {
      startedAt ??= now()
      completedFrames = Math.max(0, Math.floor(safeNonNegative(completed)))
      totalFrames = Math.max(0, Math.floor(safeNonNegative(total)))
    },
    snapshot(): ExportPerformanceSnapshot {
      const elapsedMs =
        startedAt === null ? 0 : safeNonNegative(now() - startedAt)
      const framesPerSecond =
        completedFrames > 0 && elapsedMs > 0
          ? completedFrames / (elapsedMs / 1_000)
          : null
      const remainingFrames = Math.max(0, totalFrames - completedFrames)
      const estimatedRemainingMs =
        framesPerSecond === null
          ? null
          : (remainingFrames / framesPerSecond) * 1_000

      return {
        completedFrames,
        totalFrames,
        elapsedMs,
        framesPerSecond,
        estimatedRemainingMs,
        phases: { ...phases },
      }
    },
  }
}

export type ExportPerformance = ReturnType<typeof createExportPerformance>
