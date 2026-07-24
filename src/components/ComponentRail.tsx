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
}

export function ComponentRail({ items, activeId, onSelect }: ComponentRailProps) {
  return (
    <nav className="component-rail" aria-label="动效组件">
      <div className="rail-heading">
        <span className="section-index">LIB / 01</span>
        <h2>COMPONENTS</h2>
      </div>
      <div className="rail-list">
        {items.map((item) => (
          <button
            type="button"
            className="rail-item"
            aria-pressed={activeId === item.id}
            onClick={() => onSelect(item.id)}
            key={item.id}
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
        ))}
      </div>
      <div className="rail-footer">
        <span>03 MODULES</span>
        <span>PHASE 01</span>
      </div>
    </nav>
  )
}
