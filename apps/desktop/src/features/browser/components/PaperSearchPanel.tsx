// GeoWork Paper Search Panel
// Search input and results list for academic paper discovery

import { useState } from 'react'
import { Search, Globe, Zap } from 'lucide-react'
import type { PaperSearchResult } from '../browserBridgeClient'
import useBrowserStore from '../browserStore'
import styles from './PaperSearchPanel.module.scss'

interface PaperSearchPanelProps {
  className?: string
}

export function PaperSearchPanel({ className = '' }: PaperSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const {
    paperResults,
    isLoading,
    searchPapers,
    addToContext,
  } = useBrowserStore()

  const handleSearch = () => {
    const query = searchQuery.trim()
    if (query) {
      searchPapers(query)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Search input */}
      <div className={styles.searchBar}>
        <input
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search academic papers..."
          className={styles.searchInput}
        />
        <button
          onClick={handleSearch}
        >
          {isLoading ? <div  /> : <Search  />}
          Search
        </button>
      </div>

      {/* Results list */}
      <div className={styles.resultsArea}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div />
            <span >Searching papers...</span>
          </div>
        ) : paperResults.length > 0 ? (
          <div >
            {paperResults.map((item: PaperSearchResult, index: number) => (
              <div key={index} className={styles.resultItem}>
                <div className={styles.resultContent}>
                  <h3 >
                    <Globe className={styles.resultUrlIcon} />
                    {item.title}
                  </h3>

                  <div className={styles.resultMeta}>
                    {item.authors.length > 0 && (
                      <span >{item.authors.join(', ')}</span>
                    )}
                    {item.year && (
                      <>
                        <span className={styles.metaSeparator}> · </span>
                        <span >{item.year}</span>
                      </>
                    )}
                  </div>

                  {item.snippet && (
                    <span >
                      {item.snippet}
                    </span>
                  )}
                </div>

                <div className={styles.resultActions}>
                  <button
                  >
                    <Globe  />
                    Open
                  </button>
                  <button
                  >
                    <Zap  />
                    To Agent
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            description={
              searchQuery
                ? 'No results found'
                : 'Enter a search query to find academic papers'
            }
            className={styles.emptyState}
          />
        )}
      </div>
    </div>
  )
}
