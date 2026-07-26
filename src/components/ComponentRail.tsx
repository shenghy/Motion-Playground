import type { MotionId } from '../motion/types'

interface RailItem {
  id: MotionId
  index: string
  name: string
  category: string
  description: string
}

interface ComponentRailProps {
  items: RailItem[]
  activeId: MotionId
  onSelect: (id: MotionId) => void
  onAddMotion?: (id: MotionId) => void
}

export function ComponentRail({
  items,
  activeId,
  onSelect,
  onAddMotion,
}: ComponentRailProps) {
  return (
    <nav className="component-rail" aria-label="动效组件">
      <div className="rail-heading">
        <span className="section-index">组件库 / 01</span>
        <h2>动效组件</h2>
      </div>
      <div className="rail-list">
        {items.map((item) => (
          <div className="rail-item-shell" key={item.id}>
            <button
              type="button"
              className="rail-item"
              aria-label={`选择组件${item.name}`}
              aria-pressed={activeId === item.id}
              draggable
              onClick={() => onSelect(item.id)}
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
        <span>06 个组件</span>
        <span>第一阶段</span>
      </div>
    </nav>
  )
}
