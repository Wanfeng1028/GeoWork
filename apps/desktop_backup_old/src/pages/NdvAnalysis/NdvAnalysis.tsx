import { useCallback, useEffect, useMemo, useState } from 'react'
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
        <div>
          <div>
            <div>项目与数据源</div>
          </div>
          <div>
            <div >
              <div>
                <label >项目 <span >*</span></label>
                <div >
                  <select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)}>
                    <option>GeoWork Research Project</option>
                    <option>Sentinel-2 NDVI Sample</option>
                  </select>
                  <button onClick={() => {
                    const name = window.prompt('输入新项目名称')
                    if (name) {
                      const newId = `proj-${Date.now()}`
                      setSelectedProjectId(newId)
                      setProjectName(name)
                      toast.success(`项目 "${name}" 已创建`)
                    }
                  }}>
                    <FolderOpen /> 新建
                  </button>
                </div>
              </div>

              <div>
                <label >遥感数据源 <span >*</span></label>
                <select value={dataSource ?? ''} onChange={(e) => handleDataSourceChange(e.target.value as 'sentinel2' | 'landsat')}>
                  <option value="">选择数据源</option>
                  {DATA_SOURCES.map((s) => (
                    <option key={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label >波段配置</label>
                <div >
                  <div>
                    <label >红光波段</label>
                    <input onChange={(e) => handleBandChange('red', e.target.value)} placeholder="如 B4" />
                  </div>
                  <div>
                    <label >近红外波段</label>
                    <input onChange={(e) => handleBandChange('nir', e.target.value)} placeholder="如 B8" />
                  </div>
                </div>
              </div>

              <div>
                <label >NDVI 阈值</label>
                <div >
                  <div>
                    <label >最小值</label>
                    <input type="number" onChange={(e) => handleThresholdChange('min', e.target.value)} step={0.01} min={-1} max={1} />
                  </div>
                  <div>
                    <label >最大值</label>
                    <input type="number" onChange={(e) => handleThresholdChange('max', e.target.value)} step={0.01} min={-1} max={1} />
                  </div>
                </div>
              </div>

              <div >
                <button
                  
                  onClick={handleAnalyze}
                >
                  {isAnalyzing ? <><div  /> 分析中...</> : <><Zap  /> 开始 NDVI 分析</>}
                </button>
                <button onClick={clearResults}>
                  <RefreshCw  /> 清除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div>
            <div >
              <div><strong>NDVI 公式:</strong> (NIR - Red) / (NIR + Red)</div>
              <div><strong>范围:</strong> [-1, 1]，值越高植被越茂密</div>
              <div><strong>Sentinel-2:</strong> 红光 B4 / 近红外 B8 (10m)</div>
              <div><strong>Landsat:</strong> 红光 B4 / 近红外 B5 (30m)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Panel */}
      <div className={styles.centerPanel}>
        <div>
          <div>
            <div >
              <div >
                <Database  /> 地图预览
              </div>
              <span>
                {dataSource ? `${dataSource} 预览` : '等待数据源选择'}
              </span>
            </div>
          </div>
          <div>
            <div className={styles.mapContainer}>
              {dataSource ? (
                <MapLibreMap layers={[]} width={undefined} height={undefined} />
              ) : (
                <div className={styles.mapPlaceholder}>
                  <Cloud  />
                  <span>选择数据源后显示地图预览</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div>
            <div >
              <FlaskConical  /> NDVI 时序分析
            </div>
          </div>
          <div>
            <NDVIChart />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        <div>
          <div>
            <div>分析参数</div>
          </div>
          <div>
            <div >
              <div>
                <div >项目 ID</div>
                <span >{selectedProjectId || '未选择'}</span>
              </div>
              <div>
                <div >数据源</div>
                <span className={dataSource === 'sentinel2' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                  {dataSource || '未选择'}
                </span>
              </div>
              <div>
                <div >波段</div>
                <div >
                  <span>Red: {bands?.red || '-'}</span>
                  <span>NIR: {bands?.nir || '-'}</span>
                </div>
              </div>
              <div>
                <div >阈值范围</div>
                <span >[{thresholds.min}, {thresholds.max}]</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div >
            <div >分析错误</div>
            <div >{error}</div>
          </div>
        )}

        {latestResult?.status === 'success' && (
          <div >
            <div >
              <CheckCircle  /> 分析完成
            </div>
            <div >NDVI 分析已完成，共处理 {latestResult.statistics?.validPixels?.toLocaleString() ?? 0} 个有效像元</div>
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className={styles.bottomPanel}>
        <div>
          <div>
            <div >
              <div >
                <FileImage  /> 分析结果
                {isAnalyzing && <div  />}
              </div>
              <div >
                <button onClick={() => setActiveTab('config')}>参数配置</button>
                <button onClick={() => setActiveTab('results')}>分析结果 ({results.length})</button>
              </div>
            </div>
          </div>
          <div>
            {activeTab === 'results' && (
              <>
                {latestStats && (
                  <div >
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
                  <table >
                    <thead>
                      <tr >
                        <th >时间</th>
                        <th >数据源</th>
                        <th >波段</th>
                        <th >均值</th>
                        <th >最大值</th>
                        <th >有效像元</th>
                        <th >状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id} >
                          <td >{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                          <td >
                            <span className={r.dataSource === 'sentinel2' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}>
                              {r.dataSource === 'sentinel2' ? 'Sentinel-2' : 'Landsat'}
                            </span>
                          </td>
                          <td >{r.bands.red}/{r.bands.nir}</td>
                          <td >{r.statistics?.mean?.toFixed(3) ?? '-'}</td>
                          <td >{r.statistics?.max?.toFixed(3) ?? '-'}</td>
                          <td >{r.statistics?.validPixels?.toLocaleString() ?? '-'}</td>
                          <td >
                            <span>
                              {r.status === 'success' ? '成功' : '失败'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div >
                    <Search  />
                    <div >暂无分析结果</div>
                    <div >配置参数后点击"开始 NDVI 分析"</div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'config' && (
              <div >
                <p>在左侧面板配置项目、数据源、波段和阈值参数。</p>
                <p>点击"开始 NDVI 分析"按钮执行 NDVI 计算。计算完成后结果将在此处展示。</p>
                <p >NDVI = (NIR - Red) / (NIR + Red)，值域 [-1, 1]</p>
              </div>
            )}
          </div>
        </div>
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
