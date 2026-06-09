import EChartsChart, { type LineSeriesItem } from './EChartsChart'
import styles from './NDVIChart.module.scss'

const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
]

const SAMPLE_DATA: LineSeriesItem[] = [
  {
    name: 'NDVI',
    data: [0.12, 0.15, 0.28, 0.45, 0.62, 0.71, 0.75, 0.73, 0.58, 0.38, 0.22, 0.14],
  },
  {
    name: 'EVI',
    data: [0.10, 0.13, 0.25, 0.40, 0.57, 0.66, 0.70, 0.68, 0.53, 0.34, 0.19, 0.11],
  },
]

export default function NDVIChart() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>NDVI 时序分析</h3>
        <span className={styles.subtitle}>Sentinel-2 · 2024 年度</span>
      </div>
      <EChartsChart
        type="line"
        series={SAMPLE_DATA}
        xAxisData={MONTHS}
        height={300}
      />
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.label}>最大值</span>
          <span className={styles.value}>0.75</span>
          <span className={styles.month}>7月</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>最小值</span>
          <span className={styles.value}>0.12</span>
          <span className={styles.month}>1月</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>年均值</span>
          <span className={styles.value}>0.44</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.label}>植被覆盖期</span>
          <span className={styles.value}>4-9月</span>
        </div>
      </div>
    </div>
  )
}
