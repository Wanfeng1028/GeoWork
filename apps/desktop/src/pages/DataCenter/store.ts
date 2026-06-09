import { create } from 'zustand'
import type { Dataset } from '../../services/dataService'
import { getDatasets, registerDataset as registerDatasetAPI, removeDataset as removeDatasetAPI, exportDatasetMetadata as exportMetadataAPI } from '../../services/dataService'

interface DataCenterState {
  datasets: Dataset[]
  selectedDataset: Dataset | null
  isLoading: boolean
  error: string | null
  setSelectedDataset: (dataset: Dataset | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  registerDataset: (dataset: Omit<Dataset, 'id' | 'status'>) => Promise<void>
  removeDataset: (id: string) => Promise<void>
  exportMetadata: (id: string) => Promise<void>
  refreshDatasets: () => Promise<void>
}

export const useDataCenterStore = create<DataCenterState>()((set, get) => ({
  datasets: [],
  selectedDataset: null,
  isLoading: false,
  error: null,

  setSelectedDataset: (dataset) => set({ selectedDataset: dataset }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  registerDataset: async (dataset) => {
    try {
      set({ isLoading: true, error: null })
      const result = await registerDatasetAPI({ ...dataset, status: 'registered' as const })
      set((state) => ({
        datasets: [...state.datasets, result],
        isLoading: false
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register dataset'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  removeDataset: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await removeDatasetAPI(id)
      set((state) => ({
        datasets: state.datasets.filter((d) => d.id !== id),
        selectedDataset: state.selectedDataset?.id === id ? null : state.selectedDataset,
        isLoading: false
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove dataset'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  exportMetadata: async (id) => {
    try {
      set({ isLoading: true, error: null })
      const metadata = await exportMetadataAPI(id)
      // Trigger download
      const blob = new Blob([metadata], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dataset-metadata-${id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      set({ isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export metadata'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  refreshDatasets: async () => {
    try {
      set({ isLoading: true, error: null })
      const datasets = await getDatasets()
      set({ datasets, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh datasets'
      set({ error: message, isLoading: false })
    }
  }
}))
