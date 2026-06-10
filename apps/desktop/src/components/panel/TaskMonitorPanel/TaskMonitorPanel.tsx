// GeoWork TaskMonitorPanel

import { List, Tag, Progress } from 'antd'
import type { TaskStep } from '../../../types/task'
import { mockSteps, mockTask } from '../../../mocks/tasks.mock'
import styles from './TaskMonitorPanel.module.scss'

export function TaskMonitorPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.taskInfo}>
        <h3>任务: {mockTask.mode} - {mockTask.id}</h3>
        <Tag color={mockTask.status === 'running' ? 'blue' : 'default'}>
          {mockTask.status}
        </Tag>
      </div>
      
      <Progress 
        percent={Math.round((mockSteps.filter(s => s.status === 'completed').length / mockSteps.length) * 100)} 
        size="small"
        className={styles.progress}
      />
      
      <List
        dataSource={mockSteps}
        renderItem={(step) => (
          <List.Item className={styles.stepItem}>
            <Tag color={
              step.status === 'completed' ? 'green' : 
              step.status === 'running' ? 'blue' : 'default'
            }>
              {step.status}
            </Tag>
            <span className={styles.stepTitle}>{step.title}</span>
            <span className={styles.stepTool}>{step.toolName}</span>
          </List.Item>
        )}
      />
    </div>
  )
}
