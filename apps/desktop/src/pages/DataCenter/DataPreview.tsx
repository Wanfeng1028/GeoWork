import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Badge } from '../../components/ui/badge'
import { Spinner } from '../../components/ui/spinner'
import { Empty } from '../../components/ui/empty'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
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
    <div className={`flex gap-2 py-1 ${span === 2 ? 'col-span-2' : ''}`}>
      <span className="text-sm text-muted-foreground min-w-[80px]">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export function DataPreview({ dataset, open, onClose }: DataPreviewProps) {
  if (!dataset) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>数据预览 — {dataset.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="raster">栅格信息</TabsTrigger>
            <TabsTrigger value="vector">矢量信息</TabsTrigger>
            <TabsTrigger value="raw">原始元数据</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="grid grid-cols-2 gap-1 border rounded p-3">
              <DescItem label="名称" span={2}>{dataset.name}</DescItem>
              <DescItem label="类型">
                <Badge variant="secondary" className={typeColors[dataset.type] || ''}>
                  {typeIcons[dataset.type]} {dataset.type}
                </Badge>
              </DescItem>
              <DescItem label="CRS">{dataset.crs}</DescItem>
              <DescItem label="范围" span={2}>
                <code className="text-xs">{formatExtent(dataset.extent)}</code>
              </DescItem>
              <DescItem label="文件大小">{formatSize(dataset.size)}</DescItem>
              <DescItem label="路径" span={2}>
                <span className="break-all">{dataset.path}</span>
              </DescItem>
              <DescItem label="状态">
                <Badge variant="secondary" className={dataset.status === 'registered' ? 'bg-green-100 text-green-800' : dataset.status === 'processing' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}>
                  {dataset.status === 'registered' ? '已登记' : dataset.status === 'processing' ? '处理中' : '错误'}
                </Badge>
              </DescItem>
            </div>
          </TabsContent>

          <TabsContent value="raster">
            {isRasterDataset(dataset) ? (
              <div className={styles.metadataSection}>
                <div className="grid grid-cols-2 gap-1 border rounded p-3">
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
                    <h5 className="font-semibold text-sm mt-4 mb-2">统计信息</h5>
                    <div className="grid grid-cols-2 gap-1 border rounded p-3">
                      <DescItem label="均值">{dataset.metadata.statistics.mean ?? 'N/A'}</DescItem>
                      <DescItem label="标准差">{dataset.metadata.statistics.std ?? 'N/A'}</DescItem>
                      <DescItem label="最小值">{dataset.metadata.statistics.min ?? 'N/A'}</DescItem>
                      <DescItem label="最大值">{dataset.metadata.statistics.max ?? 'N/A'}</DescItem>
                    </div>
                  </>
                )}
                <h5 className="font-semibold text-sm mt-4 mb-2">缩略图</h5>
                <div className="flex flex-col items-center justify-center p-8 border rounded bg-muted/50">
                  <FileImage className="w-12 h-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground mt-2">缩略图预览区域</span>
                </div>
              </div>
            ) : (
              <Empty description="当前数据不是栅格格式" />
            )}
          </TabsContent>

          <TabsContent value="vector">
            {isVectorDataset(dataset) ? (
              <div className={styles.metadataSection}>
                <div className="grid grid-cols-2 gap-1 border rounded p-3">
                  <DescItem label="要素数">{dataset.metadata.features ?? 'N/A'}</DescItem>
                  <DescItem label="几何类型">{dataset.metadata.geometryType ?? 'N/A'}</DescItem>
                  <DescItem label="字段数" span={2}>
                    {dataset.metadata.fields ? dataset.metadata.fields.length : 'N/A'}
                  </DescItem>
                </div>
                {dataset.metadata.fields && dataset.metadata.fields.length > 0 && (
                  <>
                    <h5 className="font-semibold text-sm mt-4 mb-2">字段列表</h5>
                    <div className="grid grid-cols-2 gap-1 border rounded p-3">
                      {dataset.metadata.fields.map((field: any, idx: number) => (
                        <DescItem key={idx} label={field.name}>
                          <Badge variant="outline">{field.type}</Badge>
                        </DescItem>
                      ))}
                    </div>
                  </>
                )}
                {dataset.metadata.attributes && (
                  <>
                    <h5 className="font-semibold text-sm mt-4 mb-2">属性预览</h5>
                    <pre className={styles.jsonPreview}>
                      {JSON.stringify(dataset.metadata.attributes, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            ) : (
              <Empty description="当前数据不是矢量格式" />
            )}
          </TabsContent>

          <TabsContent value="raw">
            <pre className={styles.jsonPreview}>
              {JSON.stringify(dataset.metadata, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
