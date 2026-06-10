import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  Input
} from 'antd'
import {
  CheckCircleOutlined,
  CloudOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileImageOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import NDVIChart from '../../components/common/NDVIChart'
import MapLibreMap from '../../map/MapLibreMap'
import { useNdvStore, type NdvResult } from './store'
import { validateNdvParams, type NdvStatistics } from '../../services/ndvService'
import styles from './NdvAnalysis.module.scss'

const { Title, Text } = Typography

const DATA_SOURCES = [
  { label: 'Sentinel-2', value: 'sentinel2' },
  { label: 'Landsat 8/9', value: 'landsat' },
] as const

const SENTINEL2_BANDS = { red: 'B4', nir: 'B8' }
const LANDSAT_BANDS = { red: 'B4', nir: 'B5' }

export default function NdvAnalysis() {
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config')

  // Zustand store
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

  // Local state for project selection
  const [projectName, setProjectName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Sync local project selection with store
  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId)
    }
  }, [selectedProjectId, setProjectId])

  // Sync data source with band presets
  const handleDataSourceChange = useCallback(
    (source: 'sentinel2' | 'landsat') => {
      setDataSource(source)
      const preset = source === 'sentinel2' ? SENTINEL2_BANDS : LANDSAT_BANDS
      setBands(preset)
      form.setFieldsValue({
        redBand: preset.red,
        nirBand: preset.nir,
      })
    },
    [setDataSource, setBands, form]
  )

  // Handle band changes
  const handleBandChange = useCallback(
    (field: 'red' | 'nir', value: string) => {
      const current = useNdvStore.getState().bands
      setBands({ red: current?.red ?? 'B4', nir: current?.nir ?? 'B8', [field]: value })
    },
    [setBands]
  )

  // Handle threshold changes
  const handleThresholdChange = useCallback(
    (field: 'min' | 'max', value: number | null) => {
      const current = useNdvStore.getState().thresholds
      setThresholds({ ...current, [field]: value ?? 0 })
    },
    [setThresholds]
  )

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  // Handle analysis submission
  const handleAnalyze = useCallback(async () => {
    const validationError = validateNdvParams({
      projectId: selectedProjectId || undefined,
      dataSource: dataSource || undefined,
      bands: bands || undefined,
      thresholds,
    })

    if (validationError) {
      message.warning(validationError)
      return
    }

    await startAnalysis()
  }, [selectedProjectId, dataSource, bands, thresholds, startAnalysis])

  // Latest result for statistics display
  const latestResult = useMemo<NdvResult | undefined>(() => {
    return results.find((r) => r.status === 'success')
  }, [results])

  const latestStats = useMemo<NdvStatistics | undefined>(() => {
    return latestResult?.statistics
  }, [latestResult])

  // Results table columns
  const resultColumns: ColumnsType<NdvResult> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (ts: string) => new Date(ts).toLocaleString('zh-CN'),
    },
    {
      title: '数据源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 100,
      render: (source: string) => (
        <Tag color={source === 'sentinel2' ? 'blue' : 'orange'}>
          {source === 'sentinel2' ? 'Sentinel-2' : 'Landsat'}
        </Tag>
      ),
    },
    {
      title: '波段',
      dataIndex: 'bands',
      key: 'bands',
      width: 120,
      render: (b: { red: string; nir: string }) => `${b.red}/${b.nir}`,
    },
    {
      title: '均值',
      dataIndex: 'statistics',
      key: 'mean',
      width: 80,
      render: (stats: NdvStatistics) => stats?.mean?.toFixed(3) ?? '-',
    },
    {
      title: '最大值',
      dataIndex: 'statistics',
      key: 'max',
      width: 80,
      render: (stats: NdvStatistics) => stats?.max?.toFixed(3) ?? '-',
    },
    {
      title: '有效像元',
      dataIndex: 'statistics',
      key: 'validPixels',
      width: 100,
      render: (stats: NdvStatistics) =>
        stats?.validPixels?.toLocaleString() ?? '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
  ]

  return (
    <div className={styles.analysisLayout}>
      {/* --- Left Panel: Project & Data Source --- */}
      <div className={styles.leftPanel}>
        <Card size="small" title="项目与数据源">
          <Form layout="vertical" form={form}>
            {/* Project Selection */}
            <Form.Item label="项目" required>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  placeholder="选择或输入项目"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={[
                    { label: 'GeoWork Research Project', value: 'proj-research' },
                    { label: 'Sentinel-2 NDVI Sample', value: 'proj-sample' },
                  ]}
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val)}
                />
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={() => {
                    const name = window.prompt('输入新项目名称')
                    if (name) {
                      const newId = `proj-${Date.now()}`
                      setSelectedProjectId(newId)
                      setProjectName(name)
                      message.success(`项目 "${name}" 已创建`)
                    }
                  }}
                >
                  新建
                </Button>
              </Space.Compact>
            </Form.Item>

            {/* Data Source */}
            <Form.Item label="遥感数据源" required>
              <Select
                placeholder="选择数据源"
                options={DATA_SOURCES as any}
                value={dataSource}
                onChange={handleDataSourceChange}
              />
            </Form.Item>

            {/* Band Selection */}
            <Form.Item label="波段配置">
              <div className={styles.bandSelector}>
                <Form.Item label="红光波段" style={{ marginBottom: 0 }}>
                  <InputValue
                    value={bands?.red}
                    onChange={(v) => handleBandChange('red', v)}
                    placeholder="如 B4"
                  />
                </Form.Item>
                <Form.Item label="近红外波段" style={{ marginBottom: 0 }}>
                  <InputValue
                    value={bands?.nir}
                    onChange={(v) => handleBandChange('nir', v)}
                    placeholder="如 B8"
                  />
                </Form.Item>
              </div>
            </Form.Item>

            {/* Thresholds */}
            <Form.Item label="NDVI 阈值">
              <div className={styles.thresholdRow}>
                <Form.Item label="最小值" style={{ marginBottom: 0 }}>
                  <InputNumber
                    value={thresholds.min}
                    min={-1}
                    max={1}
                    step={0.01}
                    precision={3}
                    style={{ width: '100%' }}
                    onChange={(v) => handleThresholdChange('min', v)}
                  />
                </Form.Item>
                <Form.Item label="最大值" style={{ marginBottom: 0 }}>
                  <InputNumber
                    value={thresholds.max}
                    min={-1}
                    max={1}
                    step={0.01}
                    precision={3}
                    style={{ width: '100%' }}
                    onChange={(v) => handleThresholdChange('max', v)}
                  />
                </Form.Item>
              </div>
            </Form.Item>

            {/* Analysis Button */}
            <div className={styles.analysisActions}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={isAnalyzing}
                disabled={!selectedProjectId || !dataSource}
                onClick={handleAnalyze}
                style={{ flex: 1 }}
              >
                {isAnalyzing ? '分析中...' : '开始 NDVI 分析'}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={clearResults}
                disabled={results.length === 0}
              >
                清除
              </Button>
            </div>
          </Form>
        </Card>

        {/* Quick Info */}
        <Card size="small" style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#60717f', lineHeight: 1.8 }}>
            <div>
              <Text strong>NDVI 公式:</Text> (NIR - Red) / (NIR + Red)
            </div>
            <div>
              <Text strong>范围:</Text> [-1, 1]，值越高植被越茂密
            </div>
            <div>
              <Text strong>Sentinel-2:</Text> 红光 B4 / 近红外 B8 (10m)
            </div>
            <div>
              <Text strong>Landsat:</Text> 红光 B4 / 近红外 B5 (30m)
            </div>
          </div>
        </Card>
      </div>

      {/* --- Center Panel: Map Preview --- */}
      <div className={styles.centerPanel}>
        <Card
          size="small"
          title={
            <Space>
              <DatabaseOutlined />
              地图预览
            </Space>
          }
          extra={
            <Tag color="blue">
              {dataSource ? `${dataSource} 预览` : '等待数据源选择'}
            </Tag>
          }
        >
          <div className={styles.mapContainer}>
            {dataSource ? (
              <MapLibreMap
                layers={[]}
                width={undefined}
                height={undefined}
              />
            ) : (
              <div className={styles.mapPlaceholder}>
                <CloudOutlined style={{ fontSize: 48 }} />
                <span>选择数据源后显示地图预览</span>
              </div>
            )}
          </div>
        </Card>

        {/* NDVI Chart */}
        <Card size="small" title={<Space><ExperimentOutlined />NDVI 时序分析</Space>}>
          <NDVIChart />
        </Card>
      </div>

      {/* --- Right Panel: Parameters (compact) --- */}
      <div className={styles.rightPanel}>
        <Card size="small" title="分析参数">
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text type="secondary">项目 ID</Text>
              <div style={{ marginTop: 4 }}>
                <Tag>{selectedProjectId || '未选择'}</Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">数据源</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={dataSource === 'sentinel2' ? 'blue' : 'orange'}>
                  {dataSource || '未选择'}
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary">波段</Text>
              <div style={{ marginTop: 4 }}>
                <Space>
                  <Tag>Red: {bands?.red || '-'}</Tag>
                  <Tag>NIR: {bands?.nir || '-'}</Tag>
                </Space>
              </div>
            </div>
            <div>
              <Text type="secondary">阈值范围</Text>
              <div style={{ marginTop: 4 }}>
                <Tag>[{thresholds.min}, {thresholds.max}]</Tag>
              </div>
            </div>
          </Space>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert
            message="分析错误"
            description={error}
            type="error"
            closable
            showIcon
          />
        )}

        {/* Success Alert */}
        {latestResult?.status === 'success' && (
          <Alert
            message="分析完成"
            description={`NDVI 分析已完成，共处理 ${latestResult.statistics?.validPixels?.toLocaleString() ?? 0} 个有效像元`}
            type="success"
            showIcon
          />
        )}
      </div>

      {/* --- Bottom Panel: Results --- */}
      <div className={styles.bottomPanel}>
        <Card
          size="small"
          className={styles.resultsCard}
          title={
            <Space>
              <FileImageOutlined />
              分析结果
              {isAnalyzing && <Spin size="small" />}
            </Space>
          }
          extra={
            <Tabs
              size="small"
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as 'config' | 'results')}
              items={[
                { key: 'config', label: '参数配置' },
                { key: 'results', label: `分析结果 (${results.length})` },
              ]}
            />
          }
        >
          {activeTab === 'results' && (
            <>
              {/* Statistics Summary */}
              {latestStats && (
                <div className={styles.statsGrid}>
                  <StatBox label="均值" value={latestStats.mean?.toFixed(3)} />
                  <StatBox label="中位数" value={latestStats.median?.toFixed(3)} />
                  <StatBox label="标准差" value={latestStats.std?.toFixed(3)} />
                  <StatBox label="最小值" value={latestStats.min?.toFixed(3)} />
                  <StatBox label="最大值" value={latestStats.max?.toFixed(3)} />
                  <StatBox
                    label="有效像元"
                    value={latestStats.validPixels?.toLocaleString()}
                  />
                  <StatBox
                    label="云像元"
                    value={latestStats.cloudPixels?.toLocaleString()}
                    color="#ff7875"
                  />
                  <StatBox
                    label="无数据"
                    value={latestStats.nodataPixels?.toLocaleString()}
                    color="#bfbfbf"
                  />
                </div>
              )}

              {/* Results Table */}
              {results.length > 0 ? (
                <Table<NdvResult>
                  className={styles.resultsTable}
                  rowKey="id"
                  dataSource={results}
                  columns={resultColumns}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  scroll={{ x: 800 }}
                />
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    color: '#8a9ba6',
                  }}
                >
                  <SearchOutlined style={{ fontSize: 32, opacity: 0.3 }} />
                  <div style={{ marginTop: 8 }}>暂无分析结果</div>
                  <div style={{ fontSize: 12 }}>
                    配置参数后点击"开始 NDVI 分析"
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'config' && (
            <div style={{ padding: '16px 0', color: '#60717f', fontSize: 13 }}>
              <p>
                在左侧面板配置项目、数据源、波段和阈值参数。
              </p>
              <p>
                点击"开始 NDVI 分析"按钮执行 NDVI 计算。
                计算完成后结果将在此处展示。
              </p>
              <p>
                <Text type="secondary">
                  NDVI = (NIR - Red) / (NIR + Red)，值域 [-1, 1]
                </Text>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// --- Sub-components ---

function InputValue({
  value,
  onChange,
  placeholder,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="small"
    />
  )
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className={styles.statItem}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={{ color: color || '#0f6b57' }}>
        {value}
      </span>
      {label === '有效像元' || label === '云像元' || label === '无数据' ? (
        <span className={styles.statUnit}>pixels</span>
      ) : (
        <span className={styles.statUnit}>NDVI</span>
      )}
    </div>
  )
}
