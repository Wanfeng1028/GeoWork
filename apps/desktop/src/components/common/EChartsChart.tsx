import { useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import styles from './EChartsChart.module.scss'

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter'

export interface ChartDataItem {
  name: string
  value: number
}

export interface LineSeriesItem {
  name: string
  data: number[]
}

export interface EChartsChartProps {
  type: ChartType
  data?: ChartDataItem[]
  series?: LineSeriesItem[]
  xAxisData?: string[]
  title?: string
  height?: number
  className?: string
}

function buildOption(props: EChartsChartProps): echarts.EChartsOption {
  const { type, data, series, xAxisData, title } = props
  const baseOption: echarts.EChartsOption = {
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: { trigger: type === 'pie' ? 'item' : 'axis' },
    legend:
      type === 'line' && series
        ? { data: series.map((s) => s.name), bottom: 0 }
        : undefined,
    grid: { left: 50, right: 24, top: 48, bottom: 36 },
    xAxis:
      type === 'pie'
        ? undefined
        : {
            type: 'category',
            data: xAxisData ?? data?.map((d) => d.name) ?? [],
            boundaryGap: type === 'bar',
          },
    yAxis:
      type === 'pie'
        ? undefined
        : {
            type: 'value',
            name: title,
          },
    series: buildSeries(type, data, series),
  }
  return baseOption
}

function buildSeries(
  type: ChartType,
  data?: ChartDataItem[],
  series?: LineSeriesItem[]
): echarts.SeriesOption[] {
  switch (type) {
    case 'line': {
      if (series) {
        return series.map((s) => ({
          name: s.name,
          type: 'line',
          data: s.data,
          smooth: true,
          areaStyle: { opacity: 0.15 },
        }))
      }
      return [
        {
          type: 'line',
          data: data?.map((d) => d.value) ?? [],
          smooth: true,
          areaStyle: { opacity: 0.15 },
        },
      ]
    }
    case 'bar':
      return [
        {
          type: 'bar',
          data: data?.map((d) => d.value) ?? [],
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
      ]
    case 'pie':
      return [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}: {c} ({d}%)' },
          data: data ?? [],
        },
      ]
    case 'scatter':
      return [
        {
          type: 'scatter',
          data:
            data?.map((d) => [d.name, d.value]) ?? [],
          symbolSize: 12,
          itemStyle: { opacity: 0.8 },
        },
      ]
    default:
      return []
  }
}

export default function EChartsChart(props: EChartsChartProps) {
  const { height = 320, className } = props
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  const dispose = useCallback(() => {
    instanceRef.current?.dispose()
    instanceRef.current = null
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current)
    instanceRef.current.setOption(buildOption(props))

    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      dispose()
    }
  }, [props, dispose])

  return (
    <div
      ref={chartRef}
      className={`${styles.chart} ${className ?? ''}`}
      style={{ height }}
    />
  )
}
