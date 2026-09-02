import { useMemo, useState } from 'react'
import type { MotionId } from '../motion/types'

interface RailItem {
  id: MotionId
  index: string
  name: string
  category: string
  description: string
  /** 局部卡（默认）叠加在视频上；全屏卡完全盖住画布 */
  scope?: 'local' | 'fullscreen'
}

interface ComponentRailProps {
  items: RailItem[]
  activeId: MotionId
  onSelect: (id: MotionId) => void
  onAddMotion?: (id: MotionId) => void
}

type RailTab = 'local' | 'fullscreen'

const TAB_LABELS: Record<RailTab, string> = {
  local: '局部卡',
  fullscreen: '全屏卡',
}

const TAB_FOOTERS: Record<RailTab, string> = {
  local: '叠加在视频上',
  fullscreen: '完全遮住视频',
}

export function ComponentRail({
  items,
  activeId,
  onSelect,
  onAddMotion,
}: ComponentRailProps) {
  const [tab, setTab] = useState<RailTab>('local')

  const localItems = useMemo(
    () => items.filter((item) => item.scope !== 'fullscreen'),
    [items],
  )
  const fullscreenItems = useMemo(
    () => items.filter((item) => item.scope === 'fullscreen'),
    [items],
  )

  // 选中的卡片类型变化时，在渲染期间直接调整页签（React 官方推荐的派生状态模式）
  const [prevActiveId, setPrevActiveId] = useState(activeId)
  if (activeId !== prevActiveId) {
    setPrevActiveId(activeId)
    const activeScope = items.find((item) => item.id === activeId)?.scope
    if (activeScope === 'fullscreen') {
      setTab('fullscreen')
    } else if (activeScope === 'local') {
      setTab('local')
    }
  }

  const visibleItems = tab === 'fullscreen' ? fullscreenItems : localItems

  return (
    <nav className="component-rail" aria-label="动效组件">
      <div className="rail-heading">
        <span className="section-index">组件库 / 01</span>
        <h2>动效组件</h2>
      </div>

      <div className="rail-tabs" role="tablist" aria-label="卡片类型">
        {(['local', 'fullscreen'] as const).map((railTab) => (
          <button
            key={railTab}
            type="button"
            role="tab"
            aria-selected={tab === railTab}
            aria-controls={`rail-panel-${railTab}`}
            className={`rail-tab${tab === railTab ? ' rail-tab--active' : ''}`}
            onClick={() => setTab(railTab)}
          >
            <span>{TAB_LABELS[railTab]}</span>
            <span className="rail-tab__count">
              {railTab === 'fullscreen'
                ? fullscreenItems.length
                : localItems.length}
            </span>
          </button>
        ))}
      </div>

      <div
        className="rail-list"
        id={`rail-panel-${tab}`}
        role="tabpanel"
        aria-label={TAB_LABELS[tab]}
      >
        {visibleItems.map((item) => (
          <div className="rail-item-shell" key={item.id}>
            <button
              type="button"
              className="rail-item"
              aria-label={`选择组件${item.name}`}
              aria-pressed={activeId === item.id}
              draggable
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onAddMotion?.(item.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData('application/x-overlay-motion', item.id)
              }}
            >
              <span className={`rail-item__preview rail-item__preview--${item.id}`} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span className="rail-item__copy">
                <span className="rail-item__meta">{item.index} / {item.category}</span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className="rail-item__arrow" aria-hidden="true">↗</span>
            </button>
            {onAddMotion ? (
              <button
                type="button"
                className="rail-item__add"
                aria-label={`在播放头添加${item.name}`}
                title={`在播放头添加${item.name}`}
                onClick={() => onAddMotion(item.id)}
              >
                <span aria-hidden="true">+</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rail-footer">
        <span>{visibleItems.length} 个组件</span>
        <span>{TAB_FOOTERS[tab]}</span>
      </div>
    </nav>
  )
}
