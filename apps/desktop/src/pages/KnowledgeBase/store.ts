import { create } from 'zustand'
import {
  getKnowledgeCategories,
  getKnowledgeEntries,
  createCategory as createCategoryAPI,
  indexPaperToKnowledge,
  importKnowledgeFile as importKnowledgeFileAPI,
  deleteKnowledgeEntry as deleteKnowledgeEntryAPI,
  searchKnowledge,
  getKnowledgeEntry,
  updateKnowledgeEntry,
} from '../../services/knowledgeService'

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  source: 'paper_id' | 'pdf' | 'manual'
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeCategory {
  id: string
  name: string
  parentId: string | null
  children?: KnowledgeCategory[]
}

interface KnowledgeBaseState {
  categories: KnowledgeCategory[]
  entries: KnowledgeEntry[]
  selectedCategory: string | null
  selectedEntry: KnowledgeEntry | null
  searchQuery: string
  isLoading: boolean
  error: string | null
  setCategories: (cats: KnowledgeCategory[]) => void
  setEntries: (entries: KnowledgeEntry[]) => void
  setSelectedCategory: (id: string | null) => void
  setSelectedEntry: (entry: KnowledgeEntry | null) => void
  setSearchQuery: (query: string) => void
  createCategory: (name: string, parentId?: string) => Promise<void>
  addEntry: (entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  indexFromPaper: (paperId: string, title: string, content: string, tags?: string[]) => Promise<void>
  importFromFile: (file: File, title?: string) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  search: (query: string) => Promise<void>
  loadCategories: () => Promise<void>
  loadEntries: (categoryId?: string, query?: string) => Promise<void>
  loadEntryDetail: (id: string) => Promise<void>
  updateEntry: (id: string, body: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'category' | 'tags'>>) => Promise<void>
  refresh: () => Promise<void>
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set, get) => ({
  categories: [],
  entries: [],
  selectedCategory: null,
  selectedEntry: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  setCategories: (cats) => set({ categories: cats }),
  setEntries: (entries) => set({ entries }),
  setSelectedCategory: (id) => set({ selectedCategory: id }),
  setSelectedEntry: (entry) => set({ selectedEntry: entry }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  createCategory: async (name, parentId) => {
    try {
      set({ isLoading: true, error: null })
      const result = await createCategoryAPI(name, parentId)
      const categories = [...get().categories, result]
      set({ categories, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to create category', isLoading: false })
    }
  },

  addEntry: async (entry) => {
    try {
      set({ isLoading: true, error: null })
      const now = new Date().toISOString()
      const newEntry: KnowledgeEntry = {
        ...entry,
        id: `entry_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      }
      const entries = [...get().entries, newEntry]
      set({ entries, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to add entry', isLoading: false })
    }
  },

  indexFromPaper: async (paperId, title, content, tags = []) => {
    try {
      set({ isLoading: true, error: null })
      await indexPaperToKnowledge(paperId, title, content, tags)
      await get().loadEntries()
      set({ isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to index paper', isLoading: false })
    }
  },

  importFromFile: async (file, title) => {
    try {
      set({ isLoading: true, error: null })
      const displayName = title || file.name
      await importKnowledgeFileAPI(file, displayName)
      await get().loadEntries()
      set({ isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to import file', isLoading: false })
    }
  },

  deleteEntry: async (id) => {
    try {
      set({ isLoading: true, error: null })
      await deleteKnowledgeEntryAPI(id)
      const entries = get().entries.filter((e) => e.id !== id)
      const selectedEntry = get().selectedEntry?.id === id ? null : get().selectedEntry
      set({ entries, selectedEntry, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete entry', isLoading: false })
    }
  },

  search: async (query) => {
    try {
      set({ isLoading: true, error: null, searchQuery: query })
      const entries = await searchKnowledge(query)
      set({ entries, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Search failed', isLoading: false })
    }
  },

  loadCategories: async () => {
    try {
      set({ isLoading: true, error: null })
      const categories = await getKnowledgeCategories()
      set({ categories, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to load categories', isLoading: false })
    }
  },

  loadEntries: async (categoryId, query) => {
    try {
      set({ isLoading: true, error: null })
      const entries = await getKnowledgeEntries(categoryId, query)
      set({ entries, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to load entries', isLoading: false })
    }
  },

  loadEntryDetail: async (id) => {
    try {
      set({ isLoading: true, error: null })
      const entry = await getKnowledgeEntry(id)
      set({ selectedEntry: entry, isLoading: false })
    } catch (err: any) {
      set({ error: err.message || 'Failed to load entry detail', isLoading: false })
    }
  },

  updateEntry: async (id, body) => {
    try {
      set({ isLoading: true, error: null })
      const updated = await updateKnowledgeEntry(id, body)
      set((state) => ({
        entries: state.entries.map((entry) => entry.id === id ? updated : entry),
        selectedEntry: state.selectedEntry?.id === id ? updated : state.selectedEntry,
        isLoading: false,
      }))
    } catch (err: any) {
      set({ error: err.message || 'Failed to update entry', isLoading: false })
    }
  },

  refresh: async () => {
    await Promise.all([get().loadCategories(), get().loadEntries()])
  },
}))
