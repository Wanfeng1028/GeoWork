import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Spinner } from '../../components/ui/spinner'
import { toast } from 'sonner'
import {
  CheckCircle,
  Cloud,
  Database,
  FlaskConical,
  FileImage,
  FolderOpen,
  RefreshCw,
  Search,
  Zap
} from 'lucide-react'
import NDVIChart from '../../components/common/NDVIChart'
import MapLibreMap from '../../map/MapLibreMap'
import { useNdvStore, type NdvResult } from './store'
import { validateNdvParams, type NdvStatistics } from '../../services/ndvService'
import styles from './NdvAnalysis.module.scss'

const DATA_SOURCES = [
  { label: 'Sentinel-2', value: 'sentinel2' },
  { label: 'Landsat 8/9', value: 'landsat' },
] as const

const SENTINEL2_BANDS = { red: 'B4', nir: 'B8' }
const LANDSAT_BANDS = { red: 'B4', nir: 'B5' }

export default function NdvAnalysis() {
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config')

  const {
    projectId,
    dataSource,
    bands,
    thresholds,
    results,
    isAnalyzing,
    error,
    setProjectId,
    setDataSource,
    setBands,
    setThresholds,
    startAnalysis,
    clearResults,
    setError,
  } = useNdvStore()

  const [projectName, setProjectName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId)
    }
  }, [selectedProjectId, setProjectId])

  const handleDataSourceChange = useCallback(
    (source: 'sentinel2' | 'landsat') => {
      setDataSource(source)
      const preset = source === 'sentinel2' ? SENTINEL2_BANDS : LANDSAT_BANDS
      setBands(preset)
    },
    [setDataSource, setBands]
  )

  const handleBandChange = useCallback(
    (field: 'red' | 'nir', value: string) => {
      const current = useNdvStore.getState().bands
      setBands({ red: current?.red ?? 'B4', nir: current?.nir ?? 'B8', [field]: value })
    },
    [setBands]
  )

  const handleThresholdChange = useCallback(
    (field: 'min' | 'max', value: string) => {
      const current = useNdvStore.getState().thresholds
      setThresholds({ ...current, [field]: parseFloat(value) || 0 })
    },
    [setThresholds]
  )

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  const handleAnalyze = useCallback(async () => {
    const validationError = validateNdvParams({
      projectId: selectedProjectId || undefined,
      dataSource: dataSource || undefined,
      bands: bands || undefined,
      thresholds,
    })

    if (validationError) {
      toast.warning(validationError)
      return
    }

    await startAnalysis()
  }, [selectedProjectId, dataSource, bands, thresholds, startAnalysis])

  const latestResult = useMemo<NdvResult | undefined>(() => {
    return results.find((r) => r.status === 'success')
  }, [results])

  const latestStats = useMemo<NdvStatistics | undefined>(() => {
    return latestResult?.statistics
  }, [latestResult])

  return (
    <div className={styles.analysisLayout}>
      {/* Left Panel */}
      <div className={styles.leftPanel}>
        <Card>
          <CardHeader>
            <CardTitle>项目与数据源</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">项目 <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  <Select value={selectedProjectId || ''} onValueChange={(val) => setSelectedProjectId(val)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="选择或输入项目" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proj-research">GeoWork Research Project</SelectItem>
                      <SelectItem value="proj-sample">Sentinel-2 NDVI Sample</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => {
                    const name = window.prompt('输入新项目名称')
                    if (name) {
                      const newId = `proj-${Date.now()}`
                      setSelectedProjectId(newId)
                      setProjectName(name)
                      toast.success(`项目 "${name}" 已创建`)
                    }
                  }}>
                    <FolderOpen className="w-4 h-4 mr-1" /> 新建
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">遥感数据源 <span className="text-destructive">*</span></label>
                <Select value={dataSource || ''} onValueChange={handleDataSourceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择数据源" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">波段配置</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">红光波段</label>
                    <Input value={bands?.red || ''} onChange={(e) => handleBandChange('red', e.target.value)} placeholder="如 B4" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">近红外波段</label>
                    <Input value={bands?.nir || ''} onChange={(e) => handleBandChange('nir', e.target.value)} placeholder="如 B8" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">NDVI 阈值</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">最小值</label>
                    <Input type="number" value={thresholds.min} onChange={(e) => handleThresholdChange('min', e.target.value)} step={0.01} min={-1} max={1} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">最大值</label>
                    <Input type="number" value={thresholds.max} onChange={(e) => handleThresholdChange('max', e.target.value)} step={0.01} min={-1} max={1} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!selectedProjectId || !dataSource || isAnalyzing}
                  onClick={handleAnalyze}
                >
                  {isAnalyzing ? <><Spinner className="w-4 h-4 mr-2" /> 分析中...</> : <><Zap className="w-4 h-4 mr-1" /> 开始 NDVI 分析</>}
                </Button>
                <Button variant="outline" onClick={clearResults} disabled={results.length === 0}>
                  <RefreshCw className="w-4 h-4 mr-1" /> 清除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <div><strong>NDVI 公式:</strong> (NIR - Red) / (NIR + Red)</div>
              <div><strong>范围:</strong> [-1, 1]，值越高植被越茂密</div>
              <div><strong>Sentinel-2:</strong> 红光 B4 / 近红外 B8 (10m)</div>
              <div><strong>Landsat:</strong> 红光 B4 / 近红外 B5 (30m)</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center Panel */}
      <div className={styles.centerPanel}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Database className="w-4 h-4" /> 地图预览
              </CardTitle>
              <Badge variant="secondary">
                {dataSource ? `${dataSource} 预览` : '等待数据源选择'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className={styles.mapContainer}>
              {dataSource ? (
                <MapLibreMap layers={[]} width={undefined} height={undefined} />
              ) : (
                <div className={styles.mapPlaceholder}>
                  <Cloud className="w-12 h-12" />
                  <span>选择数据源后显示地图预览</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" /> NDVI 时序分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NDVIChart />
          </CardContent>
        </Card>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <Card>
          <CardHeader>
            <CardTitle>分析参数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">项目 ID</div>
                <Badge variant="outline" className="mt-1">{selectedProjectId || '未选择'}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">数据源</div>
                <Badge variant="secondary" className={dataSource === 'sentinel2' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                  {dataSource || '未选择'}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">波段</div>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline">Red: {bands?.red || '-'}</Badge>
                  <Badge variant="outline">NIR: {bands?.nir || '-'}</Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">阈值范围</div>
                <Badge variant="outline" className="mt-1">[{thresholds.min}, {thresholds.max}]</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded border border-destructive bg-destructive/10 p-3">
            <div className="font-semibold text-destructive">分析错误</div>
            <div className="text-sm">{error}</div>
          </div>
        )}

        {latestResult?.status === 'success' && (
          <div className="rounded border border-green-500 bg-green-50 p-3">
            <div className="flex items-center gap-2 font-semibold text-green-700">
              <CheckCircle className="w-4 h-4" /> 分析完成
            </div>
            <div className="text-sm">NDVI 分析已完成，共处理 {latestResult.statistics?.validPixels?.toLocaleString() ?? 0} 个有效像元</div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className={styles.bottomPanel}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileImage className="w-4 h-4" /> 分析结果
                {isAnalyzing && <Spinner className="w-4 h-4" />}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant={activeTab === 'config' ? 'default' : 'outline'} onClick={() => setActiveTab('config')}>参数配置</Button>
                <Button size="sm" variant={activeTab === 'results' ? 'default' : 'outline'} onClick={() => setActiveTab('results')}>分析结果 ({results.length})</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'results' && (
              <>
                {latestStats && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <StatBox label="均值" value={latestStats.mean?.toFixed(3)} />
                    <StatBox label="中位数" value={latestStats.median?.toFixed(3)} />
                    <StatBox label="标准差" value={latestStats.std?.toFixed(3)} />
                    <StatBox label="最小值" value={latestStats.min?.toFixed(3)} />
                    <StatBox label="最大值" value={latestStats.max?.toFixed(3)} />
                    <StatBox label="有效像元" value={latestStats.validPixels?.toLocaleString()} />
                    <StatBox label="云像元" value={latestStats.cloudPixels?.toLocaleString()} color="text-red-400" />
                    <StatBox label="无数据" value={latestStats.nodataPixels?.toLocaleString()} color="text-gray-400" />
                  </div>
                )}

                {results.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">时间</th>
                        <th className="text-left p-2 w-[100px]">数据源</th>
                        <th className="text-left p-2 w-[120px]">波段</th>
                        <th className="text-left p-2 w-[80px]">均值</th>
                        <th className="text-left p-2 w-[80px]">最大值</th>
                        <th className="text-left p-2 w-[100px]">有效像元</th>
                        <th className="text-left p-2 w-[80px]">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="p-2">{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                          <td className="p-2">
                            <Badge variant="secondary" className={r.dataSource === 'sentinel2' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                              {r.dataSource === 'sentinel2' ? 'Sentinel-2' : 'Landsat'}
                            </Badge>
                          </td>
                          <td className="p-2">{r.bands.red}/{r.bands.nir}</td>
                          <td className="p-2">{r.statistics?.mean?.toFixed(3) ?? '-'}</td>
                          <td className="p-2">{r.statistics?.max?.toFixed(3) ?? '-'}</td>
                          <td className="p-2">{r.statistics?.validPixels?.toLocaleString() ?? '-'}</td>
                          <td className="p-2">
                            <Badge variant={r.status === 'success' ? 'default' : 'destructive'}>
                              {r.status === 'success' ? '成功' : '失败'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto opacity-30" />
                    <div className="mt-2">暂无分析结果</div>
                    <div className="text-xs">配置参数后点击"开始 NDVI 分析"</div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'config' && (
              <div className="py-4 text-muted-foreground text-sm">
                <p>在左侧面板配置项目、数据源、波段和阈值参数。</p>
                <p>点击"开始 NDVI 分析"按钮执行 NDVI 计算。计算完成后结果将在此处展示。</p>
                <p className="text-xs">NDVI = (NIR - Red) / (NIR + Red)，值域 [-1, 1]</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value?: string; color?: string }) {
  return (
    <div className={styles.statItem}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${color || 'text-[#0f6b57]'}`}>{value}</span>
      <span className={styles.statUnit}>
        {label === '有效像元' || label === '云像元' || label === '无数据' ? 'pixels' : 'NDVI'}
      </span>
    </div>
  )
}
