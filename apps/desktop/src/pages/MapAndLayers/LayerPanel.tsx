import React, { useCallback, useState } from 'react'
import { Switch, Slider, Dropdown, Tooltip, Popconfirm, message, Modal, Input } from 'antd'
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  PropertySafetyOutlined,
  DragOutlined,
  FileImageOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
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
    let nextName = layer.name
    Modal.confirm({
      title: '重命名图层',
      content: <Input defaultValue={layer.name} onChange={(event) => { nextName = event.target.value }} autoFocus />,
      okText: '保存',
      cancelText: '取消',
      onOk: () => {
        renameLayer(layer.id, nextName)
        message.success('图层已重命名')
      }
    })
  }

  const style: React.CSSProperties = {
    paddingLeft: `${depth * 20 + 8}px`
  }

  const typeIcon = layer.type === 'raster' ? <FileImageOutlined /> : layer.type === 'vector' ? <UnorderedListOutlined /> : <PropertySafetyOutlined />

  const contextMenu: MenuProps = {
    items: [
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => removeLayer(layer.id).then(() => message.success('图层已删除')) },
      { key: 'rename', icon: <EditOutlined />, label: '重命名', onClick: openRename },
      { key: 'copy', icon: <CopyOutlined />, label: '复制图层', onClick: () => { duplicateLayer(layer.id); message.success('图层已复制') } },
      { type: 'divider' },
      { key: 'properties', icon: <PropertySafetyOutlined />, label: '图层属性', onClick: () => setSelectedLayer(layer) }
    ]
  }

  return (
    <div style={style} className={styles.layerItem}>
      <div className={styles.layerHeader}>
        <DragOutlined className={styles.dragHandle} />
        <span className={styles.typeIcon}>{typeIcon}</span>
        <span className={styles.layerName} onClick={() => setSelectedLayer(layer)}>{layer.name}</span>
        <Switch
          size="small"
          checked={layer.visible}
          onChange={() => toggleLayer(layer.id)}
          checkedChildren={<EyeOutlined />}
          unCheckedChildren={<EyeInvisibleOutlined />}
        />
        <Tooltip title="透明度">
          <Slider
            className={styles.opacitySlider}
            value={layer.opacity}
            onChange={(v) => setLayerOpacity(layer.id, v)}
            min={0}
            max={100}
            step={1}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </Tooltip>
        <Dropdown menu={contextMenu} trigger={['contextMenu']}>
          <div className={styles.moreBtn}>⋯</div>
        </Dropdown>
      </div>
    </div>
  )
}

export function LayerPanel() {
  const layers = useMapViewStore((s) => s.layers)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string) => {
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
        <Popconfirm title="确认按当前顺序保存？" onConfirm={() => message.success('图层顺序已保存')}>
          <span className={styles.reorderHint}>拖拽排序</span>
        </Popconfirm>
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
