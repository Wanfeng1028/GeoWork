// GeoWork ArtifactPanel — 连接 useArtifactStore 真实数据 + 交付物清单

import { useState, useMemo } from 'react'
import { List, Tag, Card, Empty, Tooltip } from 'antd'
import {
  FileImageOutlined,
  FileTextOutlined,
  CodeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  DatabaseOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import useArtifactStore from '../../../stores/artifactStore'
import useShellStore from '../../../stores/shellStore'
import type { Artifact, ArtifactType } from '../../../types/artifact'
import styles from './ArtifactPanel.module.scss'

const typeColors: Record<ArtifactType, string> = {
  map: 'green',
  code: 'blue',
  document: 'orange',
  data: 'purple',
  image: 'geekblue',
  ppt: 'magenta',
  pdf: 'red',
  diff: 'cyan',
  log: 'default',
}

const typeLabels: Record<ArtifactType, string> = {
  map: '地图',
  code: '代码',
  document: '文档',
  data: '数据',
  image: '图片',
  ppt: '演示文稿',
  pdf: 'PDF',
  diff: '差异',
  log: '日志',
}

const typeIcons: Record<ArtifactType, React.ReactNode> = {
  map: <FileImageOutlined />,
  code: <CodeOutlined />,
  document: <FileTextOutlined />,
  data: <FileExcelOutlined />,
  image: <FileImageOutlined />,
  ppt: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
  diff: <CodeOutlined />,
  log: <FileTextOutlined />,
}

function getFileExtension(path: string): string {
  return '.' + path.split('.').pop()?.toLowerCase() || ''
}

export function ArtifactPanel() {
  const { artifacts, currentPreview, setPreviewArtifact, clearPreview } = useArtifactStore()
  const { setActiveRightPanel } = useShellStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Group artifacts by type
  const groupedByType = useMemo(() => {
    const groups: Record<string, Artifact[]> = {}
    artifacts.forEach(artifact => {
      const type = artifact.type
      if (!groups[type]) groups[type] = []
      groups[type].push(artifact)
    })
    return groups
  }, [artifacts])

  const sortedTypes = useMemo(() => {
    const order: ArtifactType[] = ['map', 'code', 'document', 'data', 'image', 'ppt', 'pdf', 'diff', 'log']
    return Object.keys(groupedByType).filter(t => order.includes(t as ArtifactType))
  }, [groupedByType])

  // Delivery checklist for completed tasks
  const deliveryChecklist = useMemo(() => {
    if (artifacts.length === 0) return null
    const maps = artifacts.filter(a => a.type === 'map' || a.type === 'image')
    const codes = artifacts.filter(a => a.type === 'code')
    const documents = artifacts.filter(a => a.type === 'document')
    const datasets = artifacts.filter(a => a.type === 'data')
    return { maps, codes, documents, datasets }
  }, [artifacts])

  const handleSelectArtifact = (artifact: Artifact) => {
    setSelectedId(artifact.id)
    setPreviewArtifact(artifact)
    setActiveRightPanel('artifacts')
  }

  if (artifacts.length === 0) {
    return (
      <div className={styles.panel}>
        <Empty
          description="暂无产物"
          className={styles.empty}
        />
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Delivery checklist */}
      {deliveryChecklist && (
        <div className={styles.deliverySection}>
          <h3 className={styles.deliveryTitle}>交付物清单</h3>
          <div className={styles.deliveryGrid}>
            {deliveryChecklist.maps.length > 0 && (
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>🗺️</span>
                <span className={styles.deliveryCount}>{deliveryChecklist.maps.length}</span>
                <span className={styles.deliveryLabel}>地图/图片</span>
              </div>
            )}
            {deliveryChecklist.codes.length > 0 && (
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>💻</span>
                <span className={styles.deliveryCount}>{deliveryChecklist.codes.length}</span>
                <span className={styles.deliveryLabel}>代码文件</span>
              </div>
            )}
            {deliveryChecklist.documents.length > 0 && (
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>📄</span>
                <span className={styles.deliveryCount}>{deliveryChecklist.documents.length}</span>
                <span className={styles.deliveryLabel}>文档</span>
              </div>
            )}
            {deliveryChecklist.datasets.length > 0 && (
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>📊</span>
                <span className={styles.deliveryCount}>{deliveryChecklist.datasets.length}</span>
                <span className={styles.deliveryLabel}>数据集</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Artifact list grouped by type */}
      <List
        dataSource={sortedTypes}
        renderItem={(type) => {
          const typeKey = type as ArtifactType
          const config = typeColors[typeKey]
          const icons = typeIcons[typeKey]
          const labels = typeLabels[typeKey]
          const items = groupedByType[typeKey] || []
          return (
            <List.Item className={styles.typeGroup}>
              <div className={styles.typeHeader}>
                <span className={styles.typeIcon}>{icons}</span>
                <span className={styles.typeLabel}>{labels}</span>
                <Tag color={config} className={styles.typeBadge}>{items.length}</Tag>
              </div>
              <List
                dataSource={items}
                renderItem={(artifact) => {
                  const isSelected = selectedId === artifact.id
                  const ext = getFileExtension(artifact.path)

                  return (
                    <List.Item className={`${styles.artifactItem} ${isSelected ? styles.selected : ''}`}>
                      <Card
                        size="small"
                        className={`${styles.artifactCard} ${isSelected ? styles.cardSelected : ''}`}
                        onClick={() => handleSelectArtifact(artifact)}
                        extra={
                          isSelected ? (
                            <Tooltip title="预览">
                              <EyeOutlined
                                className={styles.acceptBtn}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Tooltip>
                          ) : null
                        }
                      >
                        <div className={styles.artifactHeader}>
                          <Tag color={typeColors[artifact.type]}>
                            {typeIcons[artifact.type]}
                            {' '}
                            {typeLabels[artifact.type]}
                          </Tag>
                          <span className={styles.artifactName}>{artifact.name}</span>
                        </div>

                        <div className={styles.artifactMeta}>
                          <Tooltip title={artifact.path}>
                            <span className={styles.artifactPath}>{artifact.path}</span>
                          </Tooltip>
                          <span className={styles.artifactDate}>
                            {new Date(artifact.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Preview placeholder based on file type */}
                        {ext === '.png' || ext === '.jpg' || ext === '.jpeg' ? (
                          <div className={styles.previewImage} />
                        ) : ext === '.geojson' ? (
                          <div className={styles.previewGeojson} />
                        ) : ext === '.csv' ? (
                          <div className={styles.previewCsv} />
                        ) : ext === '.html' || ext === '.htm' ? (
                          <div className={styles.previewHtml} />
                        ) : (
                          <div className={styles.previewCode} />
                        )}
                      </Card>
                    </List.Item>
                  )
                }}
              />
            </List.Item>
          )
        }}
      />

      {/* Preview panel */}
      {currentPreview && (
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>{currentPreview.name}</span>
            <button
              className={styles.previewClose}
              onClick={clearPreview}
            >
              ×
            </button>
          </div>
          <div className={styles.previewContent}>
            <ArtifactPreview artifact={currentPreview} />
          </div>
        </div>
      )}
    </div>
  )
}

// Artifact preview renderer
function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  const ext = getFileExtension(artifact.path)
  const type = artifact.type

  if (type === 'map') {
    return (
      <div className={styles.previewMap}>
        <div className={styles.mapPlaceholder}>
          <FileImageOutlined className={styles.mapIcon} />
          <p>地图预览: {artifact.path}</p>
          <p className={styles.previewHint}>实际地图渲染将在服务端完成</p>
        </div>
      </div>
    )
  }

  if (type === 'image') {
    return (
      <div className={styles.previewImageContainer}>
        <div className={styles.imagePlaceholder}>
          <FileImageOutlined className={styles.imageIcon} />
          <p>图片: {artifact.name}</p>
          <p className={styles.previewHint}>支持 .png, .jpg, .jpeg, .gif, .webp</p>
        </div>
      </div>
    )
  }

  if (ext === '.geojson') {
    return (
      <div className={styles.previewGeojsonContainer}>
        <pre className={styles.geojsonPlaceholder}>
          <code>{`{\n  "type": "FeatureCollection",\n  "features": [\n    // ${artifact.name} 内容将在服务端加载\n  ]\n}`}</code>
        </pre>
      </div>
    )
  }

  if (ext === '.csv') {
    return (
      <div className={styles.previewCsvContainer}>
        <pre className={styles.csvPlaceholder}>
          {`column1, column2, column3\n------, ------, ------\ndata1, data2, data3`}
        </pre>
      </div>
    )
  }

  if (ext === '.html' || ext === '.htm') {
    return (
      <div className={styles.previewHtmlContainer}>
        <div className={styles.htmlPlaceholder}>
          <CodeOutlined className={styles.htmlIcon} />
          <p>HTML 预览: {artifact.name}</p>
          <p className={styles.previewHint}>HTML 内容将在 iframe 中渲染</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.previewCodeContainer}>
      <pre className={styles.codePlaceholder}>
        <code>// {artifact.name} ({artifact.mimeType})</code>
        <code>{`// 文件路径: ${artifact.path}`}</code>
        <code>{`// 创建时间: ${new Date(artifact.createdAt).toLocaleString()}`}</code>
        <code className={styles.previewHint}>// 实际内容将在服务端加载后展示</code>
      </pre>
    </div>
  )
}

export default ArtifactPanel
