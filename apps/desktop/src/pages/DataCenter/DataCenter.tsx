import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Database, Trash2, Download, Search, RefreshCw, Eye, HardDrive, Layers3 } from 'lucide-react'
import { useDataCenterStore } from './store'
import { DataPreview } from './DataPreview'
import type { Dataset } from '../../services/dataService'
import styles from './DataCenter.module.scss'

const DATASET_TYPES: Dataset['type'][] = ['GeoTIFF', 'Shapefile', 'GeoPackage', 'CSV', 'GeoJSON', 'NetCDF']

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
    } catch {}
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

  const rasterCount = datasets.filter((d) => d.type === 'GeoTIFF' || d.type === 'NetCDF').length
  const vectorCount = datasets.filter((d) => ['Shapefile', 'GeoPackage', 'GeoJSON', 'CSV'].includes(d.type)).length

  return (
    <div className={styles.dataCenter}>
      <div className={styles.pageHeader}>
        <div>
          <h2>数据中心</h2>
          <p>管理和预览项目数据集</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.ghostButton} onClick={refreshDatasets} disabled={isLoading}>
            <RefreshCw size={14} />
            <span>刷新</span>
          </button>
          <button className={styles.primaryButton} onClick={() => setRegisterModalOpen(true)}>
            <Plus size={14} />
            <span>登记数据集</span>
          </button>
        </div>
      </div>

      <div className={styles.summaryRow}>
        <MetricCard icon={Database} value={datasets.length} label="数据集总数" />
        <MetricCard icon={HardDrive} value={rasterCount} label="栅格数据" />
        <MetricCard icon={Layers3} value={vectorCount} label="矢量数据" />
      </div>

      <section className={styles.tablePanel}>
        <div className={styles.tableToolbar}>
          <div className={styles.searchBox}>
            <Search size={14} />
            <input
              placeholder="搜索数据集名称或路径..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className={styles.resultCount}>{filtered.length} 个结果</span>
        </div>

        <div className={styles.datasetTable}>
          <div className={styles.tableHead}>
            <span>名称</span>
            <span>类型</span>
            <span>CRS</span>
            <span>大小</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <div className={styles.tableBody}>
            {filtered.map((record) => (
              <div className={styles.tableRow} key={record.id}>
                <div className={styles.nameCell}>
                  <span className={styles.datasetIcon}><Database size={15} /></span>
                  <div>
                    <strong>{record.name}</strong>
                    <small>{record.path}</small>
                  </div>
                </div>
                <span className={`${styles.badge} ${styles.typeBadge}`}>{record.type}</span>
                <span className={styles.mutedCell}>{record.crs}</span>
                <span className={styles.mutedCell}>{formatSize(record.size)}</span>
                <span className={`${styles.badge} ${record.status === 'registered' ? styles.success : record.status === 'processing' ? styles.pending : styles.error}`}>
                  {record.status === 'registered' ? '已登记' : record.status === 'processing' ? '处理中' : '错误'}
                </span>
                <div className={styles.rowActions}>
                  <button onClick={() => setSelectedDataset(record)} title="预览"><Eye size={14} /></button>
                  <button onClick={() => handleExport(record.id)} title="导出"><Download size={14} /></button>
                  <button className={styles.dangerButton} onClick={() => handleRemove(record.id)} title="移除"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className={styles.emptyState}>暂无匹配的数据集</div>}
          </div>
        </div>
      </section>

      <div>
        <div className={styles.registerDialog}>
          <div>
            <div>登记新数据集</div>
          </div>
          <div className={styles.formGrid}>
            <Field label="名称">
              <input placeholder="例如: Sentinel-2 NDVI 2024" onChange={(e) => setFormState({ ...formState, name: e.target.value })} />
            </Field>
            <Field label="类型">
              <select
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value })}
              >
                {DATASET_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="路径">
              <input placeholder="C:\\data\\sensor\\image.tif" onChange={(e) => setFormState({ ...formState, path: e.target.value })} />
            </Field>
            <Field label="CRS">
              <input placeholder="EPSG:4326" onChange={(e) => setFormState({ ...formState, crs: e.target.value })} />
            </Field>
            <Field label="文件大小 (bytes)">
              <input type="number" placeholder="1048576" onChange={(e) => setFormState({ ...formState, size: e.target.value })} />
            </Field>
          </div>
          <div>
            <button onClick={() => setRegisterModalOpen(false)}>取消</button>
            <button onClick={handleRegister}>登记</button>
          </div>
        </div>
      </div>

      <DataPreview dataset={selectedDataset} open={!!selectedDataset} onClose={() => setSelectedDataset(null)} />
    </div>
  )
}

function MetricCard({ icon: Icon, value, label }: { icon: typeof Database; value: number; label: string }) {
  return (
    <div className={styles.metricCard}>
      <Icon size={16} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function formatSize(size: number): string {
  if (size === 0) return 'N/A'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(size) / Math.log(1024))
  return `${(size / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
