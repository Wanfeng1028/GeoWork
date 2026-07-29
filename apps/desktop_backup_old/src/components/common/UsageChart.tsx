import { useState } from 'react'
import EChartsChart, { type ChartDataItem, type ChartType } from './EChartsChart'
import styles from './UsageChart.module.scss'

const MODE_TASKS: ChartDataItem[] = [
  { name: 'Research', value: 42 },
  { name: 'Data', value: 38 },
  { name: 'GeoCode', value: 65 },
  { name: 'Analysis', value: 51 },
  { name: 'Write', value: 29 },
]

const COST_DISTRIBUTION: ChartDataItem[] = [
  { name: 'Research', value: 35 },
  { name: 'Data', value: 20 },
  { name: 'GeoCode', value: 15 },
  { name: 'Analysis', value: 22 },
  { name: 'Write', value: 8 },
]

export default function UsageChart() {
  const [chartType, setChartType] = useState<ChartType>('bar')

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <h3>用量统计</h3>
        <div >
          <button
            onClick={() => setChartType('bar')}
          >
            柱状图
          </button>
          <button
            onClick={() => setChartType('pie')}
          >
            饼图
          </button>
        </div>
      </div>
      <div className={styles.chartCard}>
        <div >
          <EChartsChart
            type={chartType}
            data={chartType === 'bar' ? MODE_TASKS : COST_DISTRIBUTION}
            xAxisData={chartType === 'bar' ? MODE_TASKS.map((d) => d.name) : undefined}
            title={chartType === 'bar' ? '各模式任务数' : '成本分布'}
            height={340}
          />
        </div>
      </div>
    </div>
  )
}
