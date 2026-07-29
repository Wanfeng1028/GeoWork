// GeoWork RuntimeEvents

import type { RuntimeEvent } from '../../../types/task'
import { mockEvents } from '../../../mocks/tasks.mock'
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
      <div >
        {mockEvents.map((event) => (
          <div key={event.id} className={styles.eventItem}>
            <span>
              {event.type}
            </span>
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
