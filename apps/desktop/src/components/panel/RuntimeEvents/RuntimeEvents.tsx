// GeoWork RuntimeEvents

import { List, Tag } from 'antd'
import type { RuntimeEvent } from '../../../types/task'
import { mockEvents } from '../../../mocks/tasks.mock'
import styles from './RuntimeEvents.module.scss'

export function RuntimeEvents() {
  const typeColors: Record<string, string> = {
    'task.started': 'blue',
    'task.progress': 'green',
    'tool.call.started': 'orange',
    'tool.call.completed': 'cyan'
  }

  return (
    <div className={styles.panel}>
      <List
        dataSource={mockEvents}
        renderItem={(event) => (
          <List.Item className={styles.eventItem}>
            <Tag color={typeColors[event.type] || 'default'}>
              {event.type}
            </Tag>
            <span className={styles.eventMessage}>{event.message}</span>
            <span className={styles.eventTime}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </List.Item>
        )}
      />
    </div>
  )
}
