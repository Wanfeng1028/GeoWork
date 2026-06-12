// GeoWork RuntimeEvents

import type { RuntimeEvent } from '../../../types/task'
import { mockEvents } from '../../../mocks/tasks.mock'
import { Badge } from '../../ui/badge'
import styles from './RuntimeEvents.module.scss'

const typeVariant: Record<string, 'info' | 'success' | 'warning' | 'accent' | 'default'> = {
  'task.started': 'info',
  'task.progress': 'success',
  'tool.call.started': 'warning',
  'tool.call.completed': 'accent',
}

export function RuntimeEvents() {
  return (
    <div className={styles.panel}>
      <div className="flex flex-col gap-1 p-2">
        {mockEvents.map((event) => (
          <div key={event.id} className={styles.eventItem}>
            <Badge variant={typeVariant[event.type] || 'default'}>
              {event.type}
            </Badge>
            <span className={styles.eventMessage}>{event.message}</span>
            <span className={styles.eventTime}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
