/**
 * Paper Search State Store
 *
 * Manages paper search state including query, results, pagination,
 * and selected paper details. Integrates with useTaskStore for
 * task progress tracking.
 */

import { create } from 'zustand'
import { downloadFile } from '../services/paperService'

export interface PaperResult {
  id: string
  title: string
  authors: string[]
  journal: string
  year: number
  citations: number
  abstract: string
  doi: string
  keywords: string[]
  bibtex: string
}

export interface SearchParams {
  query: string
  author?: string
  yearFrom?: number
  yearTo?: number
  topic?: string
  page?: number
  pageSize?: number
}

export interface PaperSearchState {
  query: string
  results: PaperResult[]
  isLoading: boolean
  total: number
  page: number
  pageSize: number
  selectedPaper: PaperResult | null
  isAdvancedOpen: boolean
  setQuery: (q: string) => void
  setSearchParams: (params: Partial<SearchParams>) => void
  search: (params?: SearchParams) => Promise<void>
  selectPaper: (paper: PaperResult | null) => void
  toggleAdvanced: () => void
  exportBibtex: (paper: PaperResult) => void
  exportCsv: (papers: PaperResult[]) => void
  indexToKnowledge: (paper: PaperResult) => Promise<void>
  clearResults: () => void
}

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

async function fetchPapers(params: SearchParams): Promise<{ results: PaperResult[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/v1/papers/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Paper search failed with status ${response.status}`)
  }

  const data = await response.json()

  // Handle both direct result arrays and wrapped responses
  if (Array.isArray(data)) {
    return { results: data, total: data.length }
  }
  if (data.results && Array.isArray(data.results)) {
    return { results: data.results, total: data.total ?? data.results.length }
  }

  return { results: [], total: 0 }
}

async function indexPaper(paperId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/papers/${paperId}/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Index paper failed with status ${response.status}`)
  }
}

export const usePaperSearchStore = create<PaperSearchState>((set, get) => ({
  query: '',
  results: [],
  isLoading: false,
  total: 0,
  page: 1,
  pageSize: 20,
  selectedPaper: null,
  isAdvancedOpen: false,

  setQuery: (q) => set({ query: q }),

  setSearchParams: (params) => set(params),

  search: async (params?) => {
    set({ isLoading: true })
    const state = get()
    const searchParams: SearchParams = {
      query: params?.query ?? state.query,
      author: params?.author ?? state.author,
      yearFrom: params?.yearFrom ?? state.yearFrom,
      yearTo: params?.yearTo ?? state.yearTo,
      topic: params?.topic ?? state.topic,
      page: params?.page ?? state.page,
      pageSize: params?.pageSize ?? state.pageSize,
    }

    try {
      const { results, total } = await fetchPapers(searchParams)
      set({
        results,
        total,
        isLoading: false,
        page: searchParams.page ?? 1,
      })
    } catch (error) {
      set({ isLoading: false, results: [], total: 0 })
      console.error('Paper search failed:', error)
    }
  },

  selectPaper: (paper) => set({ selectedPaper: paper }),

  toggleAdvanced: () => set((state) => ({ isAdvancedOpen: !state.isAdvancedOpen })),

  exportBibtex: (paper) => {
    downloadFile(`${paper.title.replace(/[^a-z0-9]/gi, '_')}.bib`, paper.bibtex, 'text/plain')
  },

  exportCsv: (papers) => {
    const headers = ['Title', 'Authors', 'Journal', 'Year', 'Citations', 'DOI', 'Keywords']
    const rows = papers.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.authors.join('; ').replace(/"/g, '""')}"`,
      `"${p.journal.replace(/"/g, '""')}"`,
      p.year.toString(),
      p.citations.toString(),
      p.doi,
      `"${p.keywords.join('; ').replace(/"/g, '""')}"`,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    downloadFile('papers_export.csv', csv, 'text/csv')
  },

  indexToKnowledge: async (paper) => {
    try {
      await indexPaper(paper.id)
    } catch (error) {
      console.error('Index paper to knowledge failed:', error)
      throw error
    }
  },

  clearResults: () => set({ results: [], total: 0, selectedPaper: null }),
}))
