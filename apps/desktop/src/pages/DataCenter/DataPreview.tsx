import { Drawer, Descriptions, Tag, Typography, Spin, Tabs, Empty } from 'antd'
import {
  FileImageOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  FileExcelOutlined,
  FilePdfOutlined
} from '@ant-design/icons'
import type { Dataset } from '../../services/dataService'
import styles from './DataPreview.module.scss'

const { Title, Text, Paragraph } = Typography

interface DataPreviewProps {
  dataset: Dataset | null
  open: boolean
  onClose: () => void
}

const typeIcons: Record<string, React.ReactNode> = {
  GeoTIFF: <FileImageOutlined />,
  Shapefile: <FileTextOutlined />,
  GeoPackage: <DatabaseOutlined />,
  CSV: <FileExcelOutlined />,
  GeoJSON: <FileTextOutlined />,
  NetCDF: <FilePdfOutlined />
}

const typeColors: Record<string, string> = {
  GeoTIFF: 'blue',
  Shapefile: 'green',
  GeoPackage: 'purple',
  CSV: 'orange',
  GeoJSON: 'cyan',
  NetCDF: 'magenta'
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function formatExtent(extent: Dataset['extent']): string {
  if (!extent) return 'N/A'
  return `(${extent.minX.toFixed(4)}, ${extent.minY.toFixed(4)}) ~ (${extent.maxX.toFixed(4)}, ${extent.maxY.toFixed(4)})`
}

function isRasterDataset(dataset: Dataset): boolean {
  return ['GeoTIFF', 'NetCDF'].includes(dataset.type)
}

function isVectorDataset(dataset: Dataset): boolean {
  return ['Shapefile', 'GeoPackage', 'CSV', 'GeoJSON'].includes(dataset.type)
}

export function DataPreview({ dataset, open, onClose }: DataPreviewProps) {
  if (!dataset) return null

  const metadataTabs = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Descriptions column={2} size="small" bordered className={styles.descriptions}>
          <Descriptions.Item label="名称" span={2}>{dataset.name}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={typeColors[dataset.type] || 'default'}>
              {typeIcons[dataset.type]} {dataset.type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="CRS">{dataset.crs}</Descriptions.Item>
          <Descriptions.Item label="范围" span={2}>
            <Text code>{formatExtent(dataset.extent)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="文件大小">{formatSize(dataset.size)}</Descriptions.Item>
          <Descriptions.Item label="路径" span={2}>
            <Text copyable={{ text: dataset.path }}>{dataset.path}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={dataset.status === 'registered' ? 'green' : dataset.status === 'processing' ? 'orange' : 'red'}>
              {dataset.status === 'registered' ? '已登记' : dataset.status === 'processing' ? '处理中' : '错误'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      )
    },
    {
      key: 'raster',
      label: '栅格信息',
      children: isRasterDataset(dataset) ? (
        <div className={styles.metadataSection}>
          <Descriptions column={2} size="small" bordered className={styles.descriptions}>
            <Descriptions.Item label="波段数">{dataset.metadata.bands ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="像元大小">
              {dataset.metadata.pixelSize ? `${dataset.metadata.pixelSize[0]} x ${dataset.metadata.pixelSize[1]}` : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="宽度">{dataset.metadata.width ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="高度">{dataset.metadata.height ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="数据类型">{dataset.metadata.dataType ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="压缩">{dataset.metadata.compression ?? 'N/A'}</Descriptions.Item>
          </Descriptions>
          {dataset.metadata.statistics && (
            <>
              <Title level={5} className={styles.sectionTitle}>统计信息</Title>
              <Descriptions column={2} size="small" bordered className={styles.descriptions}>
                <Descriptions.Item label="均值">{dataset.metadata.statistics.mean ?? 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="标准差">{dataset.metadata.statistics.std ?? 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="最小值">{dataset.metadata.statistics.min ?? 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="最大值">{dataset.metadata.statistics.max ?? 'N/A'}</Descriptions.Item>
              </Descriptions>
            </>
          )}
          <Title level={5} className={styles.sectionTitle}>缩略图</Title>
          <div className={styles.thumbnailPlaceholder}>
            <FileImageOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
            <Text type="secondary">缩略图预览区域</Text>
          </div>
        </div>
      ) : (
        <Empty description="当前数据不是栅格格式" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )
    },
    {
      key: 'vector',
      label: '矢量信息',
      children: isVectorDataset(dataset) ? (
        <div className={styles.metadataSection}>
          <Descriptions column={2} size="small" bordered className={styles.descriptions}>
            <Descriptions.Item label="要素数">{dataset.metadata.features ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="几何类型">{dataset.metadata.geometryType ?? 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="字段数" span={2}>
              {dataset.metadata.fields ? dataset.metadata.fields.length : 'N/A'}
            </Descriptions.Item>
          </Descriptions>
          {dataset.metadata.fields && dataset.metadata.fields.length > 0 && (
            <>
              <Title level={5} className={styles.sectionTitle}>字段列表</Title>
              <Descriptions column={2} size="small" bordered className={styles.descriptions}>
                {dataset.metadata.fields.map((field: any, idx: number) => (
                  <Descriptions.Item key={idx} label={field.name}>
                    <Tag>{field.type}</Tag>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </>
          )}
          {dataset.metadata.attributes && (
            <>
              <Title level={5} className={styles.sectionTitle}>属性预览</Title>
              <pre className={styles.jsonPreview}>
                {JSON.stringify(dataset.metadata.attributes, null, 2)}
              </pre>
            </>
          )}
        </div>
      ) : (
        <Empty description="当前数据不是矢量格式" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )
    },
    {
      key: 'raw',
      label: '原始元数据',
      children: (
        <pre className={styles.jsonPreview}>
          {JSON.stringify(dataset.metadata, null, 2)}
        </pre>
      )
    }
  ]

  return (
    <Drawer
      title={`数据预览 — ${dataset.name}`}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      className={styles.drawer}
    >
      <Tabs defaultActiveKey="basic" items={metadataTabs} className={styles.tabs} />
    </Drawer>
  )
}
