// GeoWork Paper Search Panel
// Search input and results list for academic paper discovery

import { useState } from 'react'
import { Input, Button, Card, List, Typography, Spin, Empty } from 'antd'
import {
  SearchOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { PaperSearchResult } from '../browserBridgeClient'
import { useBrowserStore } from '../browserStore'
import styles from './PaperSearchPanel.module.scss'

const { Title, Text } = Typography

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
          onPressEnter={handleSearch}
          placeholder="Search academic papers..."
          prefix={<SearchOutlined />}
          suffix={
            <Button
              type="primary"
              size="small"
              loading={isLoading}
              onClick={handleSearch}
              icon={<SearchOutlined />}
            >
              Search
            </Button>
          }
          className={styles.searchInput}
        />
      </div>

      {/* Results list */}
      <div className={styles.resultsArea}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Spin size="large" />
            <Text type="secondary">Searching papers...</Text>
          </div>
        ) : paperResults.length > 0 ? (
          <List
            dataSource={paperResults}
            locale={{ emptyText: '' }}
            renderItem={(item: PaperSearchResult, index: number) => (
              <List.Item className={styles.resultItem}>
                <div className={styles.resultContent}>
                  <Title level={5} className={styles.resultTitle}>
                    <GlobalOutlined className={styles.resultUrlIcon} />
                    {item.title}
                  </Title>

                  <div className={styles.resultMeta}>
                    {item.authors.length > 0 && (
                      <Text type="secondary">{item.authors.join(', ')}</Text>
                    )}
                    {item.year && (
                      <>
                        <Text className={styles.metaSeparator}> · </Text>
                        <Text type="secondary">{item.year}</Text>
                      </>
                    )}
                  </div>

                  {item.snippet && (
                    <Text type="secondary" className={styles.resultSnippet}>
                      {item.snippet}
                    </Text>
                  )}
                </div>

                <div className={styles.resultActions}>
                  <Button
                    size="small"
                    type="link"
                    icon={<GlobalOutlined />}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    loading={isLoading}
                    icon={<ThunderboltOutlined />}
                    title="Add to context"
                  >
                    To Agent
                  </Button>
                </div>
              </List.Item>
            )}
          />
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
