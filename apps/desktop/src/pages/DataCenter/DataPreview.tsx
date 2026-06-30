import {
  FileImage,
  FileText,
  Database,
  FileSpreadsheet,
  File
} from 'lucide-react'
import type { Dataset } from '../../services/dataService'
import styles from './DataPreview.module.scss'

interface DataPreviewProps {
  dataset: Dataset | null
  open: boolean
  onClose: () => void
}

const typeIcons: Record<string, React.ReactNode> = {
  GeoTIFF: <FileImage />,
  Shapefile: <FileText />,
  GeoPackage: <Database />,
  CSV: <FileSpreadsheet />,
  GeoJSON: <FileText />,
  NetCDF: <File />
}

const typeColors: Record<string, string> = {
  GeoTIFF: 'bg-blue-100 text-blue-800',
  Shapefile: 'bg-green-100 text-green-800',
  GeoPackage: 'bg-purple-100 text-purple-800',
  CSV: 'bg-orange-100 text-orange-800',
  GeoJSON: 'bg-cyan-100 text-cyan-800',
  NetCDF: 'bg-pink-100 text-pink-800'
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

function DescItem({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={`${span === 2 ? 'col-span-2' : ''}`}>
      <span >{label}</span>
      <span >{children}</span>
    </div>
  )
}

export function DataPreview({ dataset, open, onClose }: DataPreviewProps) {
  if (!dataset) return null

  return (
    <div>
      <div >
        <div>
          <div>数据预览 — {dataset.name}</div>
        </div>

        <div>
          <div>
            <button>基本信息</button>
            <button>栅格信息</button>
            <button>矢量信息</button>
            <button>原始元数据</button>
          </div>

          <div>
            <div >
              <DescItem label="名称" span={2}>{dataset.name}</DescItem>
              <DescItem label="类型">
                <span className={typeColors[dataset.type] || ''}>
                  {typeIcons[dataset.type]} {dataset.type}
                </span>
              </DescItem>
              <DescItem label="CRS">{dataset.crs}</DescItem>
              <DescItem label="范围" span={2}>
                <code >{formatExtent(dataset.extent)}</code>
              </DescItem>
              <DescItem label="文件大小">{formatSize(dataset.size)}</DescItem>
              <DescItem label="路径" span={2}>
                <span >{dataset.path}</span>
              </DescItem>
              <DescItem label="状态">
                <span className={dataset.status === 'registered' ? 'bg-green-100 text-green-800' : dataset.status === 'processing' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}>
                  {dataset.status === 'registered' ? '已登记' : dataset.status === 'processing' ? '处理中' : '错误'}
                </span>
              </DescItem>
            </div>
          </div>

          <div>
            {isRasterDataset(dataset) ? (
              <div className={styles.metadataSection}>
                <div >
                  <DescItem label="波段数">{dataset.metadata.bands ?? 'N/A'}</DescItem>
                  <DescItem label="像元大小">
                    {dataset.metadata.pixelSize ? `${dataset.metadata.pixelSize[0]} x ${dataset.metadata.pixelSize[1]}` : 'N/A'}
                  </DescItem>
                  <DescItem label="宽度">{dataset.metadata.width ?? 'N/A'}</DescItem>
                  <DescItem label="高度">{dataset.metadata.height ?? 'N/A'}</DescItem>
                  <DescItem label="数据类型">{dataset.metadata.dataType ?? 'N/A'}</DescItem>
                  <DescItem label="压缩">{dataset.metadata.compression ?? 'N/A'}</DescItem>
                </div>
                {dataset.metadata.statistics && (
                  <>
                    <h5 >统计信息</h5>
                    <div >
                      <DescItem label="均值">{dataset.metadata.statistics.mean ?? 'N/A'}</DescItem>
                      <DescItem label="标准差">{dataset.metadata.statistics.std ?? 'N/A'}</DescItem>
                      <DescItem label="最小值">{dataset.metadata.statistics.min ?? 'N/A'}</DescItem>
                      <DescItem label="最大值">{dataset.metadata.statistics.max ?? 'N/A'}</DescItem>
                    </div>
                  </>
                )}
                <h5 >缩略图</h5>
                <div >
                  <FileImage  />
                  <span >缩略图预览区域</span>
                </div>
              </div>
            ) : (
              <div>当前数据不是栅格格式</div>
            )}
          </div>

          <div>
            {isVectorDataset(dataset) ? (
              <div className={styles.metadataSection}>
                <div >
                  <DescItem label="要素数">{dataset.metadata.features ?? 'N/A'}</DescItem>
                  <DescItem label="几何类型">{dataset.metadata.geometryType ?? 'N/A'}</DescItem>
                  <DescItem label="字段数" span={2}>
                    {dataset.metadata.fields ? dataset.metadata.fields.length : 'N/A'}
                  </DescItem>
                </div>
                {dataset.metadata.fields && dataset.metadata.fields.length > 0 && (
                  <>
                    <h5 >字段列表</h5>
                    <div >
                      {dataset.metadata.fields.map((field: any, idx: number) => (
                        <DescItem key={idx} label={field.name}>
                          <span>{field.type}</span>
                        </DescItem>
                      ))}
                    </div>
                  </>
                )}
                {dataset.metadata.attributes && (
                  <>
                    <h5 >属性预览</h5>
                    <pre className={styles.jsonPreview}>
                      {JSON.stringify(dataset.metadata.attributes, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            ) : (
              <div>当前数据不是矢量格式</div>
            )}
          </div>

          <div>
            <pre className={styles.jsonPreview}>
              {JSON.stringify(dataset.metadata, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
