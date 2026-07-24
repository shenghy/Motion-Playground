import type { Control, ParameterValue, ParameterValues } from '../motion/types'

interface ParameterPanelProps {
  controls: Control[]
  values: ParameterValues
  onChange: (key: string, value: ParameterValue) => void
  onReset: () => void
  onReplay: () => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function ParameterPanel({
  controls,
  values,
  onChange,
  onReset,
  onReplay,
}: ParameterPanelProps) {
  return (
    <aside className="parameter-panel" aria-label="动效参数">
      <div className="panel-heading">
        <div>
          <span className="section-index">CTRL / 03</span>
          <h2>PARAMETERS</h2>
        </div>
        <span className="live-indicator"><i /> LIVE</span>
      </div>

      <div className="control-list">
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
          <span>↺</span> 恢复默认
        </button>
        <button className="button button--primary" type="button" onClick={onReplay}>
          <span>▶</span> 重新播放
        </button>
      </div>
    </aside>
  )
}
