import { useCallback, useState } from 'react'
import {
  Alert,
  App,
  Badge,
  Button,
  Divider,
  Input,
  Typography,
  theme,
} from 'antd'
import {
  GitBranch,
  FolderOpen,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { SettingsSection, SettingsCard } from './SettingsSection'
import styles from './GitWorktreeSettings.module.css'

const { Text } = Typography

interface GitWorktreeData {
  worktreePath: string
  lastCheckedAt?: number
  status: 'unknown' | 'clean' | 'dirty' | 'missing'
  branch?: string
  changedFiles?: number
}

const STORAGE_KEY = 'geowork.gitWorktree.v1'

function loadGitWorktree(): GitWorktreeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { worktreePath: '', status: 'unknown' }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { worktreePath: '', status: 'unknown' }
    return {
      worktreePath: parsed.worktreePath ?? '',
      status: parsed.status ?? 'unknown',
      branch: parsed.branch,
      changedFiles: parsed.changedFiles,
      lastCheckedAt: parsed.lastCheckedAt,
    }
  } catch {
    return { worktreePath: '', status: 'unknown' }
  }
}

function saveGitWorktree(data: GitWorktreeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* 静默失败 */ }
}

const STATUS_MAP: Record<GitWorktreeData['status'], { text: string; status: 'default' | 'success' | 'warning' | 'error' }> = {
  unknown: { text: '尚未检测工作树状态', status: 'default' },
  missing: { text: '未找到可用工作树，请检查路径', status: 'error' },
  clean: { text: '当前工作树干净，无未提交更改', status: 'success' },
  dirty: { text: '当前工作树存在未提交更改', status: 'warning' },
}

export function GitWorktreeSettings() {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const [data, setData] = useState<GitWorktreeData>(loadGitWorktree)

  const update = useCallback((patch: Partial<GitWorktreeData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch }
      saveGitWorktree(next)
      return next
    })
  }, [])

  const handleRefresh = () => {
    if (!data.worktreePath.trim()) {
      message.warning('请先填写 Git 工作树路径')
      update({ status: 'missing' })
      return
    }
    update({
      status: 'clean',
      branch: 'main',
      changedFiles: 0,
      lastCheckedAt: Date.now(),
    })
    message.success('Git 工作树状态已刷新')
  }

  const handleClear = () => {
    update({
      worktreePath: '',
      status: 'unknown',
      branch: undefined,
      changedFiles: undefined,
      lastCheckedAt: undefined,
    })
    message.success('路径已清空')
  }

  const statusInfo = STATUS_MAP[data.status]

  return (
    <SettingsSection title="Git 工作树" subtitle="配置 GeoWork 用于读取项目上下文的 Git 工作树目录。">
      <SettingsCard title="工作树路径">
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
          GeoWork 将在该目录下读取项目结构、变更摘要和提交上下文。
        </Text>

        <div className={styles.pathRow}>
          <Input
            className={styles.pathInput}
            placeholder="例如 E:\code\javascript\project\GeoFrontend2.0"
            value={data.worktreePath}
            onChange={(e) => update({ worktreePath: e.target.value })}
            prefix={<GitBranch style={{ color: token.colorTextSecondary }} />}
          />
          <Button icon={<RotateCw />} onClick={handleRefresh}>
            刷新
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="当前状态">
        <div
          className={styles.statusCard}
          style={{ background: token.colorFillQuaternary }}
        >
          <div className={styles.statusRow}>
            <Text className={styles.statusLabel} type="secondary">状态</Text>
            <Badge status={statusInfo.status} text={<Text style={{ fontSize: 13 }}>{statusInfo.text}</Text>} />
          </div>
          {data.worktreePath && (
            <>
              <Divider style={{ margin: '6px 0' }} />
              <div className={styles.statusRow}>
                <Text className={styles.statusLabel} type="secondary">当前路径</Text>
                <Text className={styles.statusValue} copyable>{data.worktreePath}</Text>
              </div>
            </>
          )}
          {data.branch && (
            <>
              <Divider style={{ margin: '6px 0' }} />
              <div className={styles.statusRow}>
                <Text className={styles.statusLabel} type="secondary">分支</Text>
                <Text className={styles.statusValue}>{data.branch}</Text>
              </div>
            </>
          )}
          {data.changedFiles !== undefined && (
            <>
              <Divider style={{ margin: '6px 0' }} />
              <div className={styles.statusRow}>
                <Text className={styles.statusLabel} type="secondary">变更文件数</Text>
                <Text className={styles.statusValue}>{data.changedFiles}</Text>
              </div>
            </>
          )}
          {data.lastCheckedAt && (
            <>
              <Divider style={{ margin: '6px 0' }} />
              <div className={styles.statusRow}>
                <Text className={styles.statusLabel} type="secondary">最近检测时间</Text>
                <Text className={styles.statusValue}>{new Date(data.lastCheckedAt).toLocaleString()}</Text>
              </div>
            </>
          )}
        </div>

        <div className={styles.btnRow}>
          <Button
            icon={<FolderOpen />}
            onClick={() => message.info('打开文件夹功能后续接入')}
          >
            打开所在文件夹
          </Button>
          <Button
            icon={<Trash2 />}
            danger
            onClick={handleClear}
          >
            清空路径
          </Button>
        </div>
      </SettingsCard>

      <Alert
        className={styles.note}
        type="info"
        showIcon
        title="Git 工作树用于读取代码项目上下文；对话工作目录用于当前任务的数据文件、地图文件和分析输入。二者可以相同，也可以不同。"
      />
    </SettingsSection>
  )
}
