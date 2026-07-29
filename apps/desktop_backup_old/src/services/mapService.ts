import { api } from './api'
import type { MapLayer } from '../pages/MapAndLayers/store'

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface GisAnalysisResult {
  statistics: Record<string, number>
  extent: BoundingBox
  crs: string
  bandCount: number
}

export async function getAvailableLayers(): Promise<MapLayer[]> {
  try {
    const res = await fetch('/api/v1/layers')
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function addLayer(params: { path: string; type: string }): Promise<MapLayer> {
  const res = await fetch('/api/v1/layers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) throw new Error('Failed to add layer')
  return await res.json()
}

export async function removeLayer(id: string): Promise<void> {
  const res = await fetch(`/api/v1/layers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('Failed to remove layer')
}

export async function getLayerMetadata(layerId: string): Promise<Record<string, any>> {
  const res = await fetch(`/api/v1/layers/${encodeURIComponent(layerId)}/metadata`)
  if (!res.ok) throw new Error('Failed to get layer metadata')
  return await res.json()
}

export async function clipRaster(layerId: string, extent: BoundingBox): Promise<void> {
  const res = await fetch('/api/v1/gis/clip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, extent })
  })
  if (!res.ok) throw new Error('Failed to clip raster')
}

export async function reprojectLayer(layerId: string, targetCRS: string): Promise<void> {
  const res = await fetch('/api/v1/gis/reproject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, targetCrs: targetCRS })
  })
  if (!res.ok) throw new Error('Failed to reproject layer')
}

export async function mergeLayers(layerIds: string[], outputPath: string): Promise<void> {
  const res = await fetch('/api/v1/gis/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerIds, outputPath })
  })
  if (!res.ok) throw new Error('Failed to merge layers')
}

export async function dissolveLayer(layerId: string, field: string): Promise<void> {
  const res = await fetch('/api/v1/gis/dissolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, field })
  })
  if (!res.ok) throw new Error('Failed to dissolve layer')
}

export async function analyzeLayer(layerId: string, analysisType: string): Promise<GisAnalysisResult> {
  const res = await fetch('/api/v1/gis/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layerId, analysisType })
  })
  if (!res.ok) throw new Error('Failed to analyze layer')
  return await res.json()
}

export const mapService = {
  getAvailableLayers,
  addLayer,
  removeLayer,
  getLayerMetadata,
  clipRaster,
  reprojectLayer,
  mergeLayers,
  dissolveLayer,
  analyzeLayer
}
