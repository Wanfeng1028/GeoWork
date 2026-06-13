import { useState, useCallback, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Empty } from '../../components/ui/empty'
import { toast } from 'sonner'
import {
  Plus,
  Database,
  Trash2,
  Download,
  Search,
  RefreshCw,
  Eye
} from 'lucide-react'
import { useDataCenterStore } from './store'
import { DataPreview } from './DataPreview'
import type { Dataset } from '../../services/dataService'
import styles from './DataCenter.module.scss'

export default function DataCenter() {
  const [search, setSearch] = useState('')
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [formState, setFormState] = useState({ name: '', type: '', path: '', crs: 'EPSG:4326', size: '' })
  const { datasets, selectedDataset, isLoading, setSelectedDataset, refreshDatasets, registerDataset, removeDataset, exportMetadata } = useDataCenterStore()

  useEffect(() => {
    refreshDatasets()
  }, [refreshDatasets])

  const handleRegister = useCallback(async () => {
    try {
      await registerDataset({
        name: formState.name,
        type: formState.type as Dataset['type'],
        path: formState.path,
        crs: formState.crs || 'EPSG:4326',
        extent: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        size: Number(formState.size) || 0,
        metadata: {}
      })
      setRegisterModalOpen(false)
      setFormState({ name: '', type: '', path: '', crs: 'EPSG:4326', size: '' })
      toast.success('数据集已登记')
    } catch {
      // error already handled in store
    }
  }, [registerDataset, formState])

  const handleRemove = useCallback(async (id: string) => {
    try {
      await removeDataset(id)
      toast.success('数据集已移除')
    } catch {}
  }, [removeDataset])

  const handleExport = useCallback(async (id: string) => {
    try {
      await exportMetadata(id)
      toast.success('元数据已导出')
    } catch {}
  }, [exportMetadata])

  const filtered = datasets.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.path.toLowerCase().includes(search.toLowerCase())
  )

  const typeColors: Record<string, string> = {
    GeoTIFF: 'bg-blue-100 text-blue-800',
    Shapefile: 'bg-green-100 text-green-800',
    GeoPackage: 'bg-purple-100 text-purple-800',
    CSV: 'bg-orange-100 text-orange-800',
    GeoJSON: 'bg-cyan-100 text-cyan-800',
    NetCDF: 'bg-pink-100 text-pink-800'
  }

  const statusColors: Record<string, string> = {
    registered: 'bg-green-100 text-green-800',
    processing: 'bg-orange-100 text-orange-800',
    error: 'bg-red-100 text-red-800'
  }

  function formatSize(size: number): string {
    if (size === 0) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(size) / Math.log(1024))
    return `${(size / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  return (
    <div className={styles.dataCenter}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 className="text-xl font-semibold m-0">数据中心</h3>
            <p className="text-sm text-muted-foreground">管理和预览项目数据集</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshDatasets} disabled={isLoading}>
              <RefreshCw className="w-4 h-4 mr-1" /> 刷新
            </Button>
            <Button onClick={() => setRegisterModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> 登记数据集
            </Button>
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="搜索数据集名称或路径..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />

        {/* Dataset Table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">名称</th>
                  <th className="text-left p-3 w-[120px]">类型</th>
                  <th className="text-left p-3 w-[120px]">CRS</th>
                  <th className="text-left p-3 w-[100px]">大小</th>
                  <th className="text-left p-3 w-[100px]">状态</th>
                  <th className="text-left p-3 w-[200px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">{record.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={typeColors[record.type] || ''}>{record.type}</Badge>
                    </td>
                    <td className="p-3">{record.crs}</td>
                    <td className="p-3">{formatSize(record.size)}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className={statusColors[record.status] || ''}>
                        {record.status === 'registered' ? '已登记' : record.status === 'processing' ? '处理中' : '错误'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedDataset(record)}>
                          <Eye className="w-3 h-3 mr-1" /> 预览
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleExport(record.id)}>
                          <Download className="w-3 h-3 mr-1" /> 导出
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleRemove(record.id)}>
                          <Trash2 className="w-3 h-3 mr-1" /> 移除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{datasets.length}</div>
              <div className="text-sm text-muted-foreground">数据集总数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{datasets.filter((d) => d.type === 'GeoTIFF').length}</div>
              <div className="text-sm text-muted-foreground">栅格数据</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{datasets.filter((d) => ['Shapefile', 'GeoPackage', 'GeoJSON'].includes(d.type)).length}</div>
              <div className="text-sm text-muted-foreground">矢量数据</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Register Dataset Modal */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登记新数据集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input placeholder="例如: Sentinel-2 NDVI 2024" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">类型</label>
              <Select value={formState.type} onValueChange={(v) => setFormState({ ...formState, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择数据类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GeoTIFF">GeoTIFF</SelectItem>
                  <SelectItem value="Shapefile">Shapefile</SelectItem>
                  <SelectItem value="GeoPackage">GeoPackage</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="GeoJSON">GeoJSON</SelectItem>
                  <SelectItem value="NetCDF">NetCDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">路径</label>
              <Input placeholder="C:\data\sensor\image.tif" value={formState.path} onChange={(e) => setFormState({ ...formState, path: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">CRS</label>
              <Input placeholder="EPSG:4326" value={formState.crs} onChange={(e) => setFormState({ ...formState, crs: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">文件大小 (bytes)</label>
              <Input type="number" placeholder="1048576" value={formState.size} onChange={(e) => setFormState({ ...formState, size: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterModalOpen(false)}>取消</Button>
            <Button onClick={handleRegister}>登记</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Preview */}
      <DataPreview dataset={selectedDataset} open={!!selectedDataset} onClose={() => setSelectedDataset(null)} />
    </div>
  )
}
