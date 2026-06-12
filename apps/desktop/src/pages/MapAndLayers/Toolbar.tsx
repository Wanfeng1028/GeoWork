import React from 'react'
import { Button } from '../../components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import { toast } from 'sonner'
import {
  Maximize,
  Highlighter,
  Scissors,
  ArrowLeftRight,
  Merge,
  SplitSquareVertical
} from 'lucide-react'
import { useMapViewStore, AVAILABLE_TOOLS } from './store'
import styles from './Toolbar.module.scss'

export function Toolbar() {
  const activeTool = useMapViewStore((s) => s.activeTool)
  const setActiveTool = useMapViewStore((s) => s.setActiveTool)
  const selectedLayer = useMapViewStore((s) => s.selectedLayer)

  const handleToolClick = (tool: (typeof AVAILABLE_TOOLS)[0]) => {
    if (!selectedLayer) {
      toast.warning('请先选择一个图层')
      return
    }
    setActiveTool(activeTool?.id === tool.id ? null : tool)
  }

  return (
    <div className={styles.toolbar}>
      <span className={styles.label}>工具</span>
      <div className={styles.tools}>
        {AVAILABLE_TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={activeTool?.id === tool.id ? 'default' : 'outline'}
                onClick={() => handleToolClick(tool)}
              >
                <span style={{ fontSize: 16 }}>{tool.icon}</span>
                {tool.name}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{getToolDescription(tool.action)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {selectedLayer && (
        <div className={styles.activeLayer}>
          当前图层: <strong>{selectedLayer.name}</strong> ({selectedLayer.type})
        </div>
      )}
    </div>
  )
}

function getToolDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'measure-distance': '在地图上点击两个点测量距离',
    'measure-area': '在地图上点击多个点测量面积',
    'annotate': '在地图上添加文字标注',
    'clip': '使用当前视图裁剪选中图层',
    'reproject': '将选中图层转换为目标坐标系',
    'merge': '将选中图层与另一个图层合并',
    'dissolve': '按指定字段对矢量图层进行合并'
  }
  return descriptions[action] || ''
}
