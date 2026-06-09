import React from 'react'
import { Button, Tooltip, Popconfirm, message } from 'antd'
import {
  BorderOutlined,
  HighlightOutlined,
  ScissorOutlined,
  SwapOutlined,
  MergeCellsOutlined,
  PartitionOutlined
} from '@ant-design/icons'
import { useMapViewStore, AVAILABLE_TOOLS } from './store'
import styles from './Toolbar.module.scss'

export function Toolbar() {
  const activeTool = useMapViewStore((s) => s.activeTool)
  const setActiveTool = useMapViewStore((s) => s.setActiveTool)
  const selectedLayer = useMapViewStore((s) => s.selectedLayer)

  const handleToolClick = (tool: (typeof AVAILABLE_TOOLS)[0]) => {
    if (!selectedLayer) {
      message.warning('请先选择一个图层')
      return
    }
    setActiveTool(activeTool?.id === tool.id ? null : tool)
  }

  return (
    <div className={styles.toolbar}>
      <span className={styles.label}>工具</span>
      <div className={styles.tools}>
        {AVAILABLE_TOOLS.map((tool) => (
          <Tooltip key={tool.id} title={tool.name}>
            <Popconfirm
              title={`确定使用${tool.name}工具？`}
              description={getToolDescription(tool.action)}
              onConfirm={() => handleToolClick(tool)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                size="small"
                type={activeTool?.id === tool.id ? 'primary' : 'default'}
                icon={<span style={{ fontSize: 16 }}>{tool.icon}</span>}
              >
                {tool.name}
              </Button>
            </Popconfirm>
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
