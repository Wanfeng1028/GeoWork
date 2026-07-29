import { useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import styles from './PlotlyChart.module.scss'

export interface TerrainData {
  x: number[]
  y: number[]
  z: number[][]
}

export interface PlotlyChartProps {
  title?: string
  height?: number
  className?: string
  /** 'terrain' | 'surface' | 'scatter3d' */
  chartType?: 'terrain' | 'surface' | 'scatter3d'
  terrainData?: TerrainData
  scatterData?: Scatter3DItem[]
}

export interface Scatter3DItem {
  x: number
  y: number
  z: number
  value?: number
}

function buildTerrainOption(data: TerrainData, title?: string): echarts.EChartsOption {
  const { x, y, z } = data
  return {
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: {
      formatter: (params: Record<string, unknown>) => {
        const d = (params.data as unknown[] | null) ?? []
        return `X: ${(d[0] ?? 0).toString()}<br/>Y: ${(d[1] ?? 0).toString()}<br/>Z: ${(d[2] ?? 0).toString()}`
      },
    } as any,
    visualMap: {
      show: true,
      min: Math.min(...z.flat()),
      max: Math.max(...z.flat()),
      inRange: {
        color: ['#1565c0', '#42a5f5', '#90caf9', '#a5d6a7', '#66bb6a', '#2e7d32'],
      },
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    xAxis3D: {
      type: 'category',
      data: x,
    },
    yAxis3D: {
      type: 'category',
      data: y,
    },
    zAxis3D: {
      type: 'value',
    },
    grid3D: {
      viewControl: {
        projection: 'perspective',
        autoRotate: true,
        distance: 180,
        alpha: 35,
        beta: 25,
      },
      light: {
        main: {
          intensity: 1.2,
          shadow: true,
        },
        ambient: {
          intensity: 0.3,
        },
      },
    },
    series: [
      {
        type: 'surface',
        data: z.map((row, yi) =>
          row.map((val, xi) => [xi, yi, val]),
        ),
        shading: 'lambert',
        label: { show: false },
      } as any,
    ],
  }
}

function buildScatter3DOption(
  data: Scatter3DItem[],
  title?: string
): echarts.EChartsOption {
  return {
    title: title
      ? { text: title, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } }
      : undefined,
    tooltip: {
      formatter: (params: Record<string, unknown>) => {
        const p = params.data as Scatter3DItem
        return `X: ${p.x}<br/>Y: ${p.y}<br/>Z: ${p.z}`
      },
    } as any,
    xAxis3D: { type: 'value', name: 'X' },
    yAxis3D: { type: 'value', name: 'Y' },
    zAxis3D: { type: 'value', name: 'Z' },
    grid3D: {
      viewControl: {
        projection: 'perspective',
        autoRotate: true,
        distance: 150,
      },
      light: {
        main: { intensity: 1.2, shadow: true },
        ambient: { intensity: 0.3 },
      },
    },
    series: [
      {
        type: 'scatter3D',
        data: data.map((d) => [d.x, d.y, d.z]),
        symbolSize: 8,
        itemStyle: { opacity: 0.9 },
      } as any,
    ],
  }
}

// Generate sample DEM terrain data
function generateSampleTerrain(rows = 30, cols = 30): TerrainData {
  const x = Array.from({ length: cols }, (_, i) => i)
  const y = Array.from({ length: rows }, (_, i) => i)
  const z: number[][] = []
  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const cx = c / cols - 0.5
      const cy = r / rows - 0.5
      const dist = Math.sqrt(cx * cx + cy * cy)
      const val =
        500 +
        200 * Math.exp(-dist * 4) +
        30 * Math.sin(c * 0.5) * Math.cos(r * 0.5) +
        (Math.random() - 0.5) * 5
      row.push(val)
    }
    z.push(row)
  }
  return { x, y, z }
}

export default function PlotlyChart(props: PlotlyChartProps) {
  const {
    height = 420,
    className,
    chartType = 'terrain',
    terrainData,
    scatterData,
    title,
  } = props

  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  const dispose = useCallback(() => {
    instanceRef.current?.dispose()
    instanceRef.current = null
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    instanceRef.current = echarts.init(chartRef.current)

    let option: echarts.EChartsOption
    if (chartType === 'terrain') {
      const data = terrainData ?? generateSampleTerrain()
      option = buildTerrainOption(data, title)
    } else if (chartType === 'scatter3d') {
      const data = scatterData ?? []
      option = buildScatter3DOption(data, title)
    } else {
      // surface fallback
      const data = terrainData ?? generateSampleTerrain()
      option = buildTerrainOption(data, title)
    }

    instanceRef.current.setOption(option)

    const onResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      dispose()
    }
  }, [terrainData, scatterData, chartType, title, dispose])

  return (
    <div
      ref={chartRef}
      className={`${styles.chart} ${className ?? ''}`}
      style={{ height }}
    />
  )
}
