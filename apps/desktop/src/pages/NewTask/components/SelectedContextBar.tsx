/**
 * SelectedContextBar.tsx
 *
 * 输入框上方的上下文 Chip 条。
 * 展示已选的技能 / 专家 / MCP，每个可单独移除，支持一键清空。
 */

import { Tag, Button, Tooltip } from 'antd'
import {
  ThunderboltOutlined,
  RobotOutlined,
  GlobalOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type { SelectedContextItem, SelectedContextKind } from './conversationStorage'
import styles from './SelectedContextBar.module.css'

/* ── 类型图标映射 ── */

const KIND_CONFIG: Record<SelectedContextKind, { icon: React.ReactNode; label: string }> = {
  skill: { icon: <ThunderboltOutlined />, label: '技能' },
  expert: { icon: <RobotOutlined />, label: '专家' },
  mcp: { icon: <GlobalOutlined />, label: 'MCP' },
}

/* ── Props ── */

interface SelectedContextBarProps {
  contexts: SelectedContextItem[]
  onRemove: (id: string, kind: SelectedContextKind) => void
  onClearAll: () => void
}

/* ── 组件 ── */

export function SelectedContextBar({
  contexts,
  onRemove,
  onClearAll,
}: SelectedContextBarProps) {
  if (contexts.length === 0) return null

  return (
    <div className={styles.bar}>
      <div className={styles.chips}>
        {contexts.map((ctx) => {
          const cfg = KIND_CONFIG[ctx.kind]
          return (
            <Tag
              key={`${ctx.kind}-${ctx.id}`}
              icon={cfg.icon}
              closable
              onClose={(e) => {
                e.preventDefault()
                onRemove(ctx.id, ctx.kind)
              }}
              className={styles.chip}
            >
              {cfg.label} · {ctx.name}
            </Tag>
          )
        })}
      </div>
      {contexts.length > 1 && (
        <Tooltip title="清空全部上下文">
          <Button
            type="text"
            size="small"
            icon={<CloseCircleOutlined />}
            className={styles.clearBtn}
            onClick={onClearAll}
          />
        </Tooltip>
      )}
    </div>
  )
}
