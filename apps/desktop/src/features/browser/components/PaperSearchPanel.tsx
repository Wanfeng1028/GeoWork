// GeoWork Paper Search Panel
// Search input and results list for academic paper discovery

import { useState } from 'react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Spinner } from '../../../components/ui/spinner'
import { Empty } from '../../../components/ui/empty'
import { Search, Globe, Zap } from 'lucide-react'
import type { PaperSearchResult } from '../browserBridgeClient'
import { useBrowserStore } from '../browserStore'
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
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search academic papers..."
          className={styles.searchInput}
        />
        <Button
          size="sm"
          disabled={isLoading}
          onClick={handleSearch}
        >
          {isLoading ? <Spinner size="sm" className="mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Search
        </Button>
      </div>

      {/* Results list */}
      <div className={styles.resultsArea}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Spinner size="lg" />
            <span className="text-[13px] text-[var(--gw-text-secondary)]">Searching papers...</span>
          </div>
        ) : paperResults.length > 0 ? (
          <div className="flex flex-col">
            {paperResults.map((item: PaperSearchResult, index: number) => (
              <div key={index} className={styles.resultItem}>
                <div className={styles.resultContent}>
                  <h3 className="text-[15px] font-semibold text-[var(--gw-text)]">
                    <Globe className={styles.resultUrlIcon} />
                    {item.title}
                  </h3>

                  <div className={styles.resultMeta}>
                    {item.authors.length > 0 && (
                      <span className="text-[13px] text-[var(--gw-text-secondary)]">{item.authors.join(', ')}</span>
                    )}
                    {item.year && (
                      <>
                        <span className={styles.metaSeparator}> · </span>
                        <span className="text-[13px] text-[var(--gw-text-secondary)]">{item.year}</span>
                      </>
                    )}
                  </div>

                  {item.snippet && (
                    <span className="text-[13px] text-[var(--gw-text-secondary)]">
                      {item.snippet}
                    </span>
                  )}
                </div>

                <div className={styles.resultActions}>
                  <Button
                    size="sm"
                    variant="link"
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isLoading}
                    title="Add to context"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    To Agent
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
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
