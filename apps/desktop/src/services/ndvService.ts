/**
 * NDVI Analysis API Service Layer
 *
 * Communicates with Go Core Runtime to perform NDVI analysis
 * and retrieve analysis history.
 */

export interface NdvBands {
  red: string
  nir: string
}

export interface NdvThresholds {
  min: number
  max: number
}

export interface NdvStatistics {
  mean: number
  median: number
  std: number
  min: number
  max: number
  validPixels: number
  cloudPixels: number
  nodataPixels: number
}

export interface NdvAnalysisRequest {
  projectId: string
  dataSource: string
  bands: NdvBands
  thresholds: NdvThresholds
  workspace?: string
}

export interface NdvAnalysisResponse {
  status: string
  ndviImagePath: string
  statistics: NdvStatistics
  message: string
  requestId: string
  timestamp: string
}

export interface NdvHistoryEntry {
  file: string
  projectId: string
  timestamp: string
  statistics: NdvStatistics
}

const API_BASE = window.geowork?.coreUrl ?? 'http://127.0.0.1:8765'

/**
 * Perform NDVI analysis on the specified raster data.
 *
 * NDVI = (NIR - Red) / (NIR + Red)
 *
 * @param params - Analysis parameters including project ID, data source, bands, and thresholds
 * @returns NDVI analysis result with statistics
 */
export async function analyzeNdv(
  params: NdvAnalysisRequest
): Promise<NdvAnalysisResponse> {
  const response = await fetch(`${API_BASE}/api/v1/ndvi/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `NDVI analysis failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Retrieve NDVI analysis history for a specific project.
 *
 * @param projectId - The project ID to query history for
 * @returns Array of NDVI analysis history entries
 */
export async function getNdvHistory(
  projectId: string
): Promise<NdvHistoryEntry[]> {
  const response = await fetch(
    `${API_BASE}/api/v1/ndvi/history/${projectId}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      errorText || `NDVI history query failed with status ${response.status}`
    )
  }

  return response.json()
}

/**
 * Validate NDVI analysis parameters before sending to the server.
 *
 * @param params - Parameters to validate
 * @returns Validation error message, or null if valid
 */
export function validateNdvParams(
  params: Partial<NdvAnalysisRequest>
): string | null {
  if (!params.projectId) {
    return '项目 ID 不能为空'
  }
  if (!params.dataSource) {
    return '数据源不能为空'
  }
  if (params.dataSource !== 'sentinel2' && params.dataSource !== 'landsat') {
    return '数据源必须是 sentinel2 或 landsat'
  }
  if (!params.bands?.red || !params.bands?.nir) {
    return '波段配置不完整'
  }
  if (
    params.thresholds?.min !== undefined &&
    params.thresholds?.max !== undefined
  ) {
    if (params.thresholds.min >= params.thresholds.max) {
      return '阈值最小值必须小于最大值'
    }
    if (params.thresholds.min < -1 || params.thresholds.max > 1) {
      return 'NDVI 阈值范围应在 [-1, 1] 之间'
    }
  }
  return null
}
