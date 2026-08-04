import type { ExportPerformanceSnapshot } from '../export/exportPerformance'

export type ExportStatus =
  | 'idle'
  | 'rendering'
  | 'encoding'
  | 'saving'
  | 'completed'
  | 'cancelled'
  | 'error'

interface ExportPanelProps {
  canExport: boolean
  movAvailable: boolean
  status: ExportStatus
  completedFrames: number
  totalFrames: number
  performance?: ExportPerformanceSnapshot
  message?: string
  onExportPng: () => void
  onExportMov: () => void
  onCancel: () => void
}

const STATUS_LABELS: Record<ExportStatus, string> = {
  idle: '等待导出',
  rendering: '正在生成透明帧',
  encoding: '正在编码透明 MOV',
  saving: '正在保存文件',
  completed: '导出完成',
  cancelled: '已取消导出',
  error: '导出失败',
}

export function ExportPanel({
  canExport,
  movAvailable,
  status,
  completedFrames,
  totalFrames,
  performance,
  message,
  onExportPng,
  onExportMov,
  onCancel,
}: ExportPanelProps) {
  const busy =
    status === 'rendering' ||
    status === 'encoding' ||
    status === 'saving'
  const percentage =
    totalFrames > 0
      ? Math.min(100, Math.round((completedFrames / totalFrames) * 100))
      : 0

  return (
    <section className="export-panel" aria-label="透明动效导出">
      <div className="export-panel__heading">
        <div>
          <span>透明动效层</span>
          <small>仅导出卡片，不包含原视频</small>
        </div>
        <span className="export-panel__format">1920×1080 / 30帧</span>
      </div>

      {busy ? (
        <div className="export-progress" aria-live="polite">
          <div className="export-progress__meta">
            <span>{STATUS_LABELS[status]}</span>
            <output>{percentage}%</output>
          </div>
          <progress
            aria-label="透明动效导出进度"
            aria-valuenow={completedFrames}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, totalFrames)}
            value={completedFrames}
            max={Math.max(1, totalFrames)}
          />
          <small>
            {completedFrames.toLocaleString()} / {totalFrames.toLocaleString()} 帧
          </small>
          {performance?.framesPerSecond !== null &&
          performance?.framesPerSecond !== undefined &&
          performance.estimatedRemainingMs !== null ? (
            <small className="export-progress__performance">
              {performance.framesPerSecond.toFixed(1)} 帧/秒 · 预计剩余{' '}
              {Math.ceil(performance.estimatedRemainingMs / 1_000)} 秒
            </small>
          ) : null}
          <button type="button" onClick={onCancel}>
            取消导出
          </button>
        </div>
      ) : (
        <>
          <div className="export-panel__actions">
            <button
              className="export-button export-button--primary"
              type="button"
              aria-label="导出透明 MOV"
              disabled={!canExport || !movAvailable}
              onClick={onExportMov}
            >
              <strong>导出透明 MOV</strong>
              <small>ProRes 4444 Alpha</small>
            </button>
            <button
              className="export-button"
              type="button"
              aria-label="导出 PNG 序列"
              disabled={!canExport}
              onClick={onExportPng}
            >
              <strong>导出 PNG 序列</strong>
              <small>逐帧透明图片</small>
            </button>
          </div>
          <p
            className={`export-panel__message export-panel__message--${status}`}
            role={status === 'error' ? 'alert' : 'status'}
          >
            {message ??
              (!canExport
                ? '请先导入视频并在时间轴添加卡片'
                : !movAvailable
                  ? '请通过桌面启动脚本打开，才能导出 MOV'
                  : STATUS_LABELS[status])}
          </p>
        </>
      )}
    </section>
  )
}
