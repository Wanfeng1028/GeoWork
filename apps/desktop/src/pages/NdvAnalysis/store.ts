import { create } from 'zustand'

export interface NdvResult {
  id: string
  projectId: string
  dataSource: string
  bands: { red: string; nir: string }
  thresholds: { min: number; max: number }
  statistics: {
    mean: number
    median: number
    std: number
    min: number
    max: number
    validPixels: number
    cloudPixels: number
    nodataPixels: number
  }
  ndviImagePath: string
  timestamp: string
  status: 'success' | 'failed'
}

export interface NdvState {
  projectId: string | null
  dataSource: 'sentinel2' | 'landsat' | null
  bands: { red: string; nir: string } | null
  thresholds: { min: number; max: number }
  results: NdvResult[]
  isAnalyzing: boolean
  error: string | null
  setProjectId: (id: string) => void
  setDataSource: (source: 'sentinel2' | 'landsat') => void
  setBands: (bands: { red: string; nir: string }) => void
  setThresholds: (thresholds: { min: number; max: number }) => void
  startAnalysis: () => Promise<void>
  clearResults: () => void
  setError: (error: string | null) => void
}

const DEFAULT_BANDS = { red: 'B4', nir: 'B8' }
const DEFAULT_THRESHOLDS = { min: -1.0, max: 1.0 }

export const useNdvStore = create<NdvState>()((set, get) => ({
  projectId: null,
  dataSource: null,
  bands: { ...DEFAULT_BANDS },
  thresholds: { ...DEFAULT_THRESHOLDS },
  results: [],
  isAnalyzing: false,
  error: null,

  setProjectId: (id) => set({ projectId: id }),

  setDataSource: (source) => set({ dataSource: source }),

  setBands: (bands) => set({ bands }),

  setThresholds: (thresholds) => set({ thresholds }),

  setError: (error) => set({ error }),

  clearResults: () => set({ results: [], error: null }),

  startAnalysis: async () => {
    const state = get()
    if (!state.projectId) {
      set({ error: '请先选择或创建项目' })
      return
    }
    if (!state.dataSource) {
      set({ error: '请选择数据源' })
      return
    }
    if (!state.bands?.red || !state.bands?.nir) {
      set({ error: '请配置波段信息' })
      return
    }

    set({ isAnalyzing: true, error: null })

    try {
      const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'
      const response = await fetch(`${API_BASE}/api/v1/ndvi/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          dataSource: state.dataSource,
          bands: state.bands,
          thresholds: state.thresholds,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || '分析请求失败')
      }

      const data = await response.json()

      const result: NdvResult = {
        id: data.requestId || Date.now().toString(),
        projectId: state.projectId!,
        dataSource: state.dataSource!,
        bands: state.bands!,
        thresholds: state.thresholds,
        statistics: data.statistics || {},
        ndviImagePath: data.ndviImagePath || '',
        timestamp: data.timestamp || new Date().toISOString(),
        status: data.status || 'success',
      }

      set((state) => ({
        results: [result, ...state.results],
        isAnalyzing: false,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : '分析失败，请稍后重试'
      set({
        isAnalyzing: false,
        error: message,
      })
    }
  },
}))
