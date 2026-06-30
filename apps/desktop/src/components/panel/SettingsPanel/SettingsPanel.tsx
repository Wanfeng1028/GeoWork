// GeoWork - SettingsPanel Component

import { useState } from 'react'
import {
  Settings,
  Palette,
  FolderOpen,
  Bot,
} from 'lucide-react'
import useSettingsStore from '../../../stores/settingsStore'
import styles from './SettingsPanel.module.scss'
import type { PermissionLevel } from '../../../types/permission'

interface ProviderOption {
  value: string
  label: string
  kind: string
}

const PROVIDERS: ProviderOption[] = [
  { value: 'prov-1', label: 'OpenAI Compatible', kind: 'openai_compatible' },
  { value: 'prov-2', label: 'Ollama Local', kind: 'ollama' },
]

const THEMES = [
  { value: 'dark', label: '暗黑' },
  { value: 'light', label: '亮色' },
]

const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'read_only', label: '只读' },
  { value: 'ask_every_time', label: '每次询问' },
  { value: 'limited', label: '受限' },
  { value: 'full_access', label: '完全访问' },
]

const MODES = [
  { value: 'Analysis', label: 'Analysis (分析)' },
  { value: 'Coding', label: 'Coding (编码)' },
  { value: 'Research', label: 'Research (研究)' },
  { value: 'PPT', label: 'PPT (演示)' },
]

const TABS = [
  { key: 'model-api', label: '模型与 API', icon: <Settings size={14} /> },
  { key: 'appearance', label: '外观', icon: <Palette size={14} /> },
  { key: 'workspace', label: '工作空间', icon: <FolderOpen size={14} /> },
  { key: 'agent', label: 'Agent 行为', icon: <Bot size={14} /> },
]

export function SettingsPanel() {
  const { settings, updateSetting } = useSettingsStore()
  const [activeTab, setActiveTab] = useState('model-api')

  const modelApi = settings.modelApi
  const appearance = settings.appearance
  const workspace = settings.workspace
  const agent = settings.agent

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={[styles.tab, styles.activeTab, styles.tab, styles.activeTab].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'model-api' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>模型与 API</h3>

            <div className={styles.settingRow}>
              <span className={styles.label}>Provider</span>
              <div className={styles.control}>
                <select value={modelApi.defaultProvider} onChange={(e) => updateSetting('modelApi.defaultProvider', e.target.value)}>
                  <option value="prov-1">OpenAI Compatible</option>
                  <option value="prov-2">Ollama Local</option>
                </select>
              </div>
            </div>

            <hr />

            <div className={styles.settingRow}>
              <span className={styles.label}>Base URL</span>
              <div className={styles.control}>
                <input placeholder="https://api.example.com/v1" className={styles.input} />
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>API Key</span>
              <div className={styles.control}>
                <input type="password" placeholder="sk-..." className={styles.input} />
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>默认模型</span>
              <div className={styles.control}>
                <select>
                  <option>GPT-4</option>
                  <option>GPT-4o</option>
                  <option>GPT-3.5 Turbo</option>
                  <option>Llama 3</option>
                </select>
              </div>
            </div>

            <hr />

            <div className={styles.settingRow}>
              <span className={styles.label}>启用缓存</span>
              <div className={styles.control}>
                <button onClick={() => updateSetting('modelApi.cacheEnabled', !modelApi.cacheEnabled)}>
                  {modelApi.cacheEnabled ? '已启用' : '已禁用'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>外观设置</h3>

            <div className={styles.settingRow}>
              <span className={styles.label}>主题</span>
              <div className={styles.control}>
                <select value={appearance.theme} onChange={(e) => updateSetting('appearance.theme', e.target.value)}>
                  {THEMES.map(t => (
                    <option key={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>字体大小</span>
                <span className={styles.valueLabel}>{appearance.fontSize}px</span>
              </div>
              <div className={styles.control}>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={appearance.fontSize}
                  onChange={(e) => updateSetting('appearance.fontSize', Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>侧边栏收起</span>
              <div className={styles.control}>
                <button onClick={() => updateSetting('appearance.sidebarCollapsed', !appearance.sidebarCollapsed)}>
                  {appearance.sidebarCollapsed ? '已收起' : '未收起'}
                </button>
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>对话缩略图</span>
              <div className={styles.control}>
                <button onClick={() => updateSetting('appearance.conversationMinimapEnabled', !appearance.conversationMinimapEnabled)}>
                  {appearance.conversationMinimapEnabled ? '已启用' : '已禁用'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>工作空间</h3>

            <div className={styles.settingRow}>
              <span className={styles.label}>工作空间根路径</span>
              <div className={styles.control}>
                <input
                  placeholder="选择工作空间目录..."
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>最近路径</span>
              <div className={styles.control}>
                {workspace.recentPaths.length > 0 ? (
                  workspace.recentPaths.map((path, index) => (
                    <div key={index} className={styles.recentPath}>
                      <span className={styles.recentPathText}>{path}</span>
                    </div>
                  ))
                ) : (
                  <span className={styles.emptyText}>暂无最近路径</span>
                )}
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>自动保存</span>
              <div className={styles.control}>
                <button onClick={() => updateSetting('workspace.autoSave', !workspace.autoSave)}>
                  {workspace.autoSave ? '已启用' : '已禁用'}
                </button>
              </div>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>自动保存间隔</span>
                <span className={styles.valueLabel}>{workspace.autoSaveInterval}s</span>
              </div>
              <div className={styles.control}>
                <input
                  type="range"
                  min={5}
                  max={300}
                  step={5}
                  value={workspace.autoSaveInterval}
                  onChange={(e) => updateSetting('workspace.autoSaveInterval', Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agent' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Agent 行为</h3>

            <div className={styles.settingRow}>
              <span className={styles.label}>默认权限等级</span>
              <div className={styles.control}>
                <select value={agent.defaultPermission} onChange={(e) => updateSetting('agent.defaultPermission', e.target.value)}>
                  {PERMISSION_LEVELS.map(p => (
                    <option key={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.settingRow}>
              <span className={styles.label}>默认模式</span>
              <div className={styles.control}>
                <select value={agent.defaultMode} onChange={(e) => updateSetting('agent.defaultMode', e.target.value)}>
                  {MODES.map(m => (
                    <option key={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>最大步数</span>
                <span className={styles.valueLabel}>{agent.maxSteps}</span>
              </div>
              <div className={styles.control}>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={agent.maxSteps}
                  onChange={(e) => updateSetting('agent.maxSteps', Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>超时时间</span>
                <span className={styles.valueLabel}>{agent.timeout}s</span>
              </div>
              <div className={styles.control}>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  onChange={(e) => updateSetting('agent.timeout', Number(e.target.value) || 300)}
                  className={styles.input}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel
