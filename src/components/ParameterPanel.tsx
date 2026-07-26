import type { Control, ParameterValue, ParameterValues } from '../motion/types'
import type { OverlayProject } from '../timeline/types'
import { ProjectFileControls } from './ProjectFileControls'

interface ParameterPanelProps {
  controls: Control[]
  values: ParameterValues
  onChange: (key: string, value: ParameterValue) => void
  onReset: () => void
  onReplay: () => void
  showSafeArea?: boolean
  onToggleSafeArea?: () => void
  videoFileName?: string
  pendingVideoFileName?: string
  videoError?: string
  onVideoFile?: (file: File) => void
  onRemoveVideo?: () => void
  project?: OverlayProject
  projectError?: string
  onProjectImport?: (text: string) => void | Promise<void>
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function ParameterPanel({
  controls,
  values,
  onChange,
  onReset,
  onReplay,
  showSafeArea = true,
  onToggleSafeArea,
  videoFileName,
  pendingVideoFileName,
  videoError,
  onVideoFile,
  onRemoveVideo,
  project,
  projectError,
  onProjectImport,
}: ParameterPanelProps) {
  return (
    <aside className="parameter-panel" aria-label="动效参数">
      <div className="panel-heading">
        <div>
          <span className="section-index">控制台 / 03</span>
          <h2>参数设置</h2>
        </div>
        <span className="live-indicator"><i /> 实时</span>
      </div>

      <div className="control-list">
        {project && onProjectImport ? (
          <ProjectFileControls
            project={project}
            error={projectError}
            onImport={onProjectImport}
          />
        ) : null}
        {onVideoFile && (
          <section className="video-setting" aria-label="视频背景">
            <div className="video-setting__heading">
              <div>
                <span>视频背景</span>
                <small>
                  {pendingVideoFileName ??
                    videoFileName ??
                    '不上传，仅在当前浏览器预览'}
                </small>
              </div>
              <span
                className="video-setting__status"
                role="status"
                aria-live="polite"
              >
                {pendingVideoFileName
                  ? '正在检查'
                  : videoFileName
                    ? '已载入'
                    : '本地'}
              </span>
            </div>
            <div className="video-setting__actions">
              <label className="video-import-button">
                <input
                  className="video-file-input"
                  type="file"
                  accept="video/*"
                  aria-label="导入本地视频"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) {
                      onVideoFile(file)
                    }
                    event.currentTarget.value = ''
                  }}
                />
                {videoFileName ? '更换视频' : '导入本地视频'}
              </label>
              {videoFileName && onRemoveVideo && (
                <button
                  className="video-remove-button"
                  type="button"
                  onClick={onRemoveVideo}
                >
                  移除视频
                </button>
              )}
            </div>
            {videoError && (
              <p className="video-setting__error" role="alert">
                {videoError}
              </p>
            )}
          </section>
        )}
        {onToggleSafeArea && (
          <div className="preview-setting">
            <div>
              <span>舞台辅助</span>
              <small>仅用于预览，不属于动效内容</small>
            </div>
            <button
              className="switch"
              type="button"
              role="switch"
              aria-label="显示人物安全区"
              aria-checked={showSafeArea}
              onClick={onToggleSafeArea}
            >
              <i />
            </button>
          </div>
        )}
        {controls.map((control) => {
          const value = values[control.key]

          if (control.type === 'text') {
            return (
              <label className="control-field" key={control.key}>
                <span>{control.label}</span>
                <input
                  aria-label={control.label}
                  maxLength={control.maxLength}
                  value={String(value ?? '')}
                  onChange={(event) =>
                    onChange(control.key, event.target.value.slice(0, control.maxLength))
                  }
                />
                <small>{String(value ?? '').length}/{control.maxLength}</small>
              </label>
            )
          }

          if (control.type === 'number') {
            const numericValue = Number(value ?? control.min)
            return (
              <label className="control-field control-field--range" key={control.key}>
                <span>{control.label}</span>
                <output>
                  {numericValue}
                  {control.suffix}
                </output>
                <input
                  type="range"
                  aria-label={control.label}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={numericValue}
                  onChange={(event) =>
                    onChange(
                      control.key,
                      clamp(Number(event.target.value), control.min, control.max),
                    )
                  }
                />
                <div className="range-limits" aria-hidden="true">
                  <small>{control.min}</small>
                  <small>{control.max}</small>
                </div>
              </label>
            )
          }

          return (
            <label className="control-field" key={control.key}>
              <span>{control.label}</span>
              <select
                aria-label={control.label}
                value={String(value)}
                onChange={(event) => onChange(control.key, event.target.value)}
              >
                {control.options.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      <div className="panel-actions">
        <button className="button button--secondary" type="button" onClick={onReset}>
          <span aria-hidden="true">↺</span> 恢复默认
        </button>
        <button className="button button--primary" type="button" onClick={onReplay}>
          <span aria-hidden="true">▶</span> 重新播放
        </button>
      </div>
    </aside>
  )
}
