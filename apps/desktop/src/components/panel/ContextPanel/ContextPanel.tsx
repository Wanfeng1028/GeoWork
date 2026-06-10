// GeoWork ContextPanel - Shows current Agent context

import { List, Tag, Typography, Empty } from 'antd'
import {
  FileTextOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import styles from './ContextPanel.module.scss'

const { Text, Title } = Typography

interface ContextItem {
  id: string;
  name: string;
  type: 'file' | 'layer' | 'paper' | 'knowledge' | 'mcp';
  size?: string;
}

// Mock context data
const mockContext: ContextItem[] = [
  { id: '1', name: 'sentinel2_b8.tif', type: 'file', size: '45.2 MB' },
  { id: '2', name: 'ndvi_analysis.py', type: 'file', size: '2.1 KB' },
  { id: '3', name: 'study_area.geojson', type: 'file', size: '128 KB' },
  { id: '4', name: 'Sentinel-2 L2A', type: 'layer', size: '12 bands' },
  { id: '5', name: 'DEM 30m', type: 'layer', size: '1 band' },
  { id: '6', name: 'Land Cover Classification', type: 'layer', size: '1 band' },
  { id: '7', name: 'Remote Sensing of Minerals (2023)', type: 'paper', size: '3.4 MB' },
  { id: '8', name: 'NDVI Methodology Notes', type: 'knowledge', size: '12 KB' },
  { id: '9', name: 'gdal_info', type: 'mcp', size: 'registered' },
  { id: '10', name: 'gee_auth', type: 'mcp', size: 'connected' },
]

const typeIcons: Record<string, React.ReactNode> = {
  file: <FileTextOutlined />,
  layer: <FileImageOutlined />,
  paper: <FilePdfOutlined />,
  knowledge: <DatabaseOutlined />,
  mcp: <DatabaseOutlined />,
}

const typeColors: Record<string, string> = {
  file: 'blue',
  layer: 'purple',
  paper: 'orange',
  knowledge: 'cyan',
  mcp: 'magenta',
}

export function ContextPanel() {
  const grouped = mockContext.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {} as Record<string, ContextItem[]>)

  const typeLabels: Record<string, string> = {
    file: '📄 文件',
    layer: '🗺️ 图层',
    paper: '📑 论文',
    knowledge: '📚 知识库',
    mcp: '🔌 MCP 工具',
  }

  return (
    <div className={styles.panel}>
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupLabel}>{typeLabels[type] || type}</span>
            <Tag color={typeColors[type]}>{items.length}</Tag>
          </div>
          <List
            size="small"
            dataSource={items}
            renderItem={(item) => (
              <List.Item className={styles.contextItem}>
                <span className={styles.contextIcon}>{typeIcons[item.type]}</span>
                <span className={styles.contextName}>{item.name}</span>
                {item.size && <span className={styles.contextSize}>{item.size}</span>}
              </List.Item>
            )}
          />
        </div>
      ))}
    </div>
  )
}
