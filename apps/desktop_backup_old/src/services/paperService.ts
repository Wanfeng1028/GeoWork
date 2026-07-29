/**
 * Paper Search Service Layer
 *
 * Communicates with Go Core Runtime to search papers via OpenAlex
 * and index papers into the knowledge base.
 */

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

export interface PaperSearchResponse {
  status: string
  results: PaperResult[]
  total: number
  page: number
  pageSize: number
  message: string
}

export interface PaperSearchParams {
  query: string
  author?: string
  yearFrom?: number
  yearTo?: number
  topic?: string
  page?: number
  pageSize?: number
}

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

/**
 * Search papers via OpenAlex database.
 *
 * @param params - Search parameters including query, filters, and pagination
 * @returns Paper search response with results and metadata
 */
export async function searchPapers(
  params: PaperSearchParams
): Promise<PaperSearchResponse> {
  const response = await fetch(`${API_BASE}/api/v1/papers/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Paper search failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Index a paper into the local knowledge base.
 *
 * @param paperId - The paper ID to index
 */
export async function indexPaperToKnowledge(paperId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/papers/${paperId}/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Index paper failed with status ${response.status}`)
  }
}

/**
 * Download a file as a blob trigger.
 *
 * @param filename - The name of the downloaded file
 * @param content - The file content string
 * @param mimeType - The MIME type of the content
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Validate paper search parameters before sending to the server.
 *
 * @param params - Parameters to validate
 * @returns Validation error message, or null if valid
 */
export function validateSearchParams(params: Partial<PaperSearchParams>): string | null {
  if (!params.query || params.query.trim().length === 0) {
    return '搜索关键词不能为空'
  }
  if (params.yearFrom !== undefined && params.yearTo !== undefined) {
    if (params.yearFrom > params.yearTo) {
      return '起始年份不能大于结束年份'
    }
  }
  if (params.page !== undefined && params.page < 1) {
    return '页码必须大于 0'
  }
  if (params.pageSize !== undefined && (params.pageSize < 1 || params.pageSize > 100)) {
    return '每页条数必须在 1-100 之间'
  }
  return null
}
