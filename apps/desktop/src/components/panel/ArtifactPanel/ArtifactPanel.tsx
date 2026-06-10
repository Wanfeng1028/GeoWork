// GeoWork ArtifactPanel

import { List, Tag, Card } from 'antd'
import type { Artifact } from '../../../types/artifact'
import { mockArtifacts } from '../../../mocks/artifacts.mock'
import styles from './ArtifactPanel.module.scss'

export function ArtifactPanel() {
  const typeColors: Record<string, string> = {
    code: 'blue',
    map: 'green',
    document: 'orange',
    data: 'purple',
    log: 'default'
  }

  const typeLabels: Record<string, string> = {
    code: '代码',
    map: '地图',
    document: '文档',
    data: '数据',
    log: '日志'
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>产物列表 ({mockArtifacts.length})</h3>
      
      <List
        dataSource={mockArtifacts}
        renderItem={(artifact) => (
          <List.Item className={styles.artifactItem}>
            <Card size="small" className={styles.artifactCard}>
              <div className={styles.artifactHeader}>
                <Tag color={typeColors[artifact.type]}>
                  {typeLabels[artifact.type]}
                </Tag>
                <span className={styles.artifactName}>{artifact.name}</span>
              </div>
              
              <div className={styles.artifactMeta}>
                <span className={styles.artifactPath}>{artifact.path}</span>
                <span className={styles.artifactDate}>
                  {new Date(artifact.createdAt).toLocaleString()}
                </span>
              </div>
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}
