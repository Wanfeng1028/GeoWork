import React from 'react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import { toast } from 'sonner'
import {
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Copy,
  Shield,
  GripVertical,
  FileImage,
  List
} from 'lucide-react'
import type { MapLayer } from './store'
import { useMapViewStore } from './store'
import styles from './LayerPanel.module.scss'

interface LayerItemProps {
  layer: MapLayer
  depth: number
  expandedIds: Set<string>
  toggleExpand: (id: string) => void
}

function LayerItem({ layer, depth, expandedIds, toggleExpand }: LayerItemProps) {
  const setSelectedLayer = useMapViewStore((s) => s.setSelectedLayer)
  const toggleLayer = useMapViewStore((s) => s.toggleLayer)
  const setLayerOpacity = useMapViewStore((s) => s.setLayerOpacity)
  const removeLayer = useMapViewStore((s) => s.removeLayer)
  const renameLayer = useMapViewStore((s) => s.renameLayer)
  const duplicateLayer = useMapViewStore((s) => s.duplicateLayer)

  const openRename = () => {
    const nextName = prompt('重命名图层', layer.name)
    if (nextName && nextName !== layer.name) {
      renameLayer(layer.id, nextName)
      toast.success('图层已重命名')
    }
  }

  const style: React.CSSProperties = {
    paddingLeft: `${depth * 20 + 8}px`
  }

  const typeIcon = layer.type === 'raster' ? <FileImage /> : layer.type === 'vector' ? <List /> : <Shield />

  return (
    <div style={style} className={styles.layerItem}>
      <div className={styles.layerHeader}>
        <GripVertical className={styles.dragHandle} />
        <span className={styles.typeIcon}>{typeIcon}</span>
        <span className={styles.layerName} onClick={() => setSelectedLayer(layer)}>{layer.name}</span>
        <Switch
          checked={layer.visible}
          onCheckedChange={() => toggleLayer(layer.id)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-16">
              <input
                type="range"
                className="w-full accent-[var(--gw-accent)]"
                value={layer.opacity}
                onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value))}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>透明度: {layer.opacity}%</TooltipContent>
        </Tooltip>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={openRename}>
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { duplicateLayer(layer.id); toast.success('图层已复制') }}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeLayer(layer.id).then(() => toast.success('图层已删除'))}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LayerPanel() {
  const layers = useMapViewStore((s) => s.layers)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>图层列表</h3>
        <span className={styles.reorderHint}>拖拽排序</span>
      </div>
      <div className={styles.layerList}>
        {layers.length === 0 && <div className={styles.empty}>暂无图层，请添加数据源</div>}
        {layers.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            depth={0}
            expandedIds={expandedIds}
            toggleExpand={toggleExpand}
          />
        ))}
      </div>
    </div>
  )
}
