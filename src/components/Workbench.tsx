import { useMemo, useState } from 'react'
import { motionRegistry, getMotionDefinition } from '../motion/registry'
import type { MotionId, ParameterValue, ParameterValues } from '../motion/types'
import { ComponentRail } from './ComponentRail'
import { ParameterPanel } from './ParameterPanel'
import { PreviewStage } from './PreviewStage'

const createInitialParameters = () => {
  const initial = {} as Record<MotionId, ParameterValues>
  motionRegistry.forEach((definition) => {
    initial[definition.id] = { ...definition.defaults }
  })
  return initial
}

export function Workbench() {
  const [activeId, setActiveId] = useState<MotionId>('metric-focus')
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [parameters, setParameters] = useState(createInitialParameters)
  const [playbackKeys, setPlaybackKeys] = useState<Record<MotionId, number>>({
    'metric-focus': 0,
    'compare-split': 0,
    'quote-lockup': 0,
  })

  const activeDefinition = useMemo(() => getMotionDefinition(activeId), [activeId])
  const activeParameters = parameters[activeId]

  const replay = () => {
    setPlaybackKeys((current) => ({
      ...current,
      [activeId]: current[activeId] + 1,
    }))
  }

  const selectMotion = (id: MotionId) => {
    setActiveId(id)
    setPlaybackKeys((current) => ({ ...current, [id]: current[id] + 1 }))
  }

  const updateParameter = (key: string, value: ParameterValue) => {
    setParameters((current) => ({
      ...current,
      [activeId]: { ...current[activeId], [key]: value },
    }))
    replay()
  }

  const resetParameters = () => {
    setParameters((current) => ({
      ...current,
      [activeId]: { ...activeDefinition.defaults },
    }))
    replay()
  }

  return (
    <div className="workbench">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Motion Playground 首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>
            <strong>MOTION PLAYGROUND</strong>
            <small>COMPONENT LAB / 01</small>
          </span>
        </a>
        <div className="header-status">
          <span>SESSION / LOCAL</span>
          <span>ENGINE / BROWSER</span>
          <span className="system-ready"><i /> SYSTEM READY</span>
        </div>
      </header>

      <div className="workspace">
        <ComponentRail
          items={motionRegistry}
          activeId={activeId}
          onSelect={selectMotion}
        />
        <PreviewStage
          motionId={activeId}
          motionName={activeDefinition.name}
          params={activeParameters}
          playbackKey={playbackKeys[activeId]}
          showSafeArea={showSafeArea}
        />
        <ParameterPanel
          controls={activeDefinition.controls}
          values={activeParameters}
          onChange={updateParameter}
          onReset={resetParameters}
          onReplay={replay}
          showSafeArea={showSafeArea}
          onToggleSafeArea={() => setShowSafeArea((visible) => !visible)}
        />
      </div>
    </div>
  )
}
