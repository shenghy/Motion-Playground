import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
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
  onClearWorkspace?: () => void | Promise<void>
  disableWorkspaceClear?: boolean
  exportControls?: ReactNode
}

type ParameterTab = 'properties' | 'transfer' | 'workspace'

const parameterTabs = [
  { id: 'properties', label: '卡片属性', index: '01' },
  { id: 'transfer', label: '导入导出', index: '02' },
  { id: 'workspace', label: '工作区', index: '03' },
] as const

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
  onClearWorkspace,
  disableWorkspaceClear = false,
  exportControls,
}: ParameterPanelProps) {
  const [activeTab, setActiveTab] = useState<ParameterTab>('properties')
  const tabRefs = useRef<Record<ParameterTab, HTMLButtonElement | null>>({
    properties: null,
    transfer: null,
    workspace: null,
  })

  const selectTab = (tab: ParameterTab, focus = false) => {
    setActiveTab(tab)
    if (focus) tabRefs.current[tab]?.focus()
  }

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: ParameterTab,
  ) => {
    const currentIndex = parameterTabs.findIndex(({ id }) => id === currentTab)
    let nextIndex: number

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % parameterTabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + parameterTabs.length) % parameterTabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = parameterTabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    selectTab(parameterTabs[nextIndex].id, true)
  }

  const renderControls = () => controls.map((control) => {
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
          <output aria-label={`${control.label} ${numericValue}`}>
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
  })

  return (
    <aside className="parameter-panel" aria-label="动效参数">
      <div className="panel-heading">
        <div>
          <span className="section-index">控制台 / 03</span>
          <h2>参数设置</h2>
        </div>
        <span className="live-indicator"><i /> 实时</span>
      </div>

      <div className="parameter-tabs" role="tablist" aria-label="参数分类">
        {parameterTabs.map((tab) => (
          <button
            className="parameter-tab"
            type="button"
            role="tab"
            id={`parameter-tab-${tab.id}`}
            aria-label={tab.label}
            aria-controls={`parameter-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            ref={(element) => {
              tabRefs.current[tab.id] = element
            }}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
            key={tab.id}
          >
            <small>{tab.index}</small>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="control-list">
        <section
            className="parameter-tabpanel parameter-tabpanel--properties"
            role="tabpanel"
            id="parameter-panel-properties"
            data-testid="parameter-panel-properties"
            aria-labelledby="parameter-tab-properties"
            aria-label="卡片属性"
            hidden={activeTab !== 'properties'}
          >
            <div className="parameter-tabpanel__intro">
              <span>当前卡片</span>
              <small>调整画面内容与动效参数</small>
            </div>
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
            {renderControls()}
            <div className="panel-actions">
              <button className="button button--secondary" type="button" onClick={onReset}>
                <span aria-hidden="true">↺</span> 恢复默认
              </button>
              <button className="button button--primary" type="button" onClick={onReplay}>
                <span aria-hidden="true">▶</span> 重新播放
              </button>
            </div>
          </section>

        <section
            className="parameter-tabpanel parameter-tabpanel--transfer"
            role="tabpanel"
            id="parameter-panel-transfer"
            data-testid="parameter-panel-transfer"
            aria-labelledby="parameter-tab-transfer"
            aria-label="导入导出"
            hidden={activeTab !== 'transfer'}
          >
            <div className="parameter-tabpanel__intro">
              <span>文件与输出</span>
              <small>集中管理视频、项目文件和透明动效</small>
            </div>
            {exportControls}
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
                        if (file) onVideoFile(file)
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
          </section>

        <section
            className="parameter-tabpanel parameter-tabpanel--workspace"
            role="tabpanel"
            id="parameter-panel-workspace"
            data-testid="parameter-panel-workspace"
            aria-labelledby="parameter-tab-workspace"
            aria-label="工作区"
            hidden={activeTab !== 'workspace'}
          >
            <div className="parameter-tabpanel__intro">
              <span>本地工作区</span>
              <small>项目数据保存在当前浏览器</small>
            </div>
            {onClearWorkspace && (
              <section className="workspace-danger-zone" aria-label="工作区管理">
                <div>
                  <span>工作区管理</span>
                  <small>清除本地视频、时间轴卡片和全部设置</small>
                </div>
                <button
                  className="workspace-clear-button"
                  type="button"
                  disabled={disableWorkspaceClear}
                  onClick={onClearWorkspace}
                >
                  {disableWorkspaceClear ? '导出期间不可清空' : '清空工作区'}
                </button>
              </section>
            )}
          </section>
      </div>
    </aside>
  )
}
