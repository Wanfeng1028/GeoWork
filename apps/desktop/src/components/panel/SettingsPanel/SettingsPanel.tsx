// GeoWork - SettingsPanel Component
// Settings panel for managing model/API, appearance, workspace, and agent behavior

import { useState } from 'react'
import { Input, Switch, Select, Slider, InputNumber, Divider } from 'antd'
import {
  SettingOutlined,
  PaletteOutlined,
  FolderOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import useSettingsStore from '../../../stores/settingsStore'
import styles from './SettingsPanel.module.scss'
import type { PermissionLevel } from '../../../types/permission'

const { TextArea } = Input

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
  { value: 'dark-geo', label: '暗黑 Geo' },
  { value: 'light-geo', label: '亮色 Geo' },
  { value: 'dark-glass', label: '暗黑玻璃' },
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
  {
    key: 'model-api',
    label: '模型与 API',
    icon: <SettingOutlined />,
  },
  {
    key: 'appearance',
    label: '外观',
    icon: <PaletteOutlined />,
  },
  {
    key: 'workspace',
    label: '工作空间',
    icon: <FolderOutlined />,
  },
  {
    key: 'agent',
    label: 'Agent 行为',
    icon: <RobotOutlined />,
  },
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
      {/* Tab Navigation */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={styles.tab}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* === Tab 1: 模型与 API === */}
        {activeTab === 'model-api' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>模型与 API</h3>

            {/* Provider Selection */}
            <div className={styles.settingRow}>
              <span className={styles.label}>Provider</span>
              <div className={styles.control}>
                <Select
                  value={modelApi.defaultProvider}
                  onChange={(val) => updateSetting('modelApi.defaultProvider', val)}
                  options={PROVIDERS}
                  className={styles.select}
                />
              </div>
            </div>

            {/* Provider Detail Section */}
            {(() => {
              const currentProvider = PROVIDERS.find(
                (p) => p.value === modelApi.defaultProvider
              )
              if (!currentProvider) return null

              const mockProvider = PROVIDERS.find(
                (p) => p.value === modelApi.defaultProvider
              )

              return (
                <>
                  <Divider className={styles.divider} />

                  {/* Base URL */}
                  <div className={styles.settingRow}>
                    <span className={styles.label}>Base URL</span>
                    <div className={styles.control}>
                      <Input
                        placeholder="https://api.example.com/v1"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className={styles.settingRow}>
                    <span className={styles.label}>API Key</span>
                    <div className={styles.control}>
                      <Input.Password
                        placeholder="sk-..."
                        className={styles.input}
                      />
                    </div>
                  </div>

                  {/* Default Model */}
                  <div className={styles.settingRow}>
                    <span className={styles.label}>默认模型</span>
                    <div className={styles.control}>
                      <Select
                        options={[
                          { value: 'gpt-4', label: 'GPT-4' },
                          { value: 'gpt-4o', label: 'GPT-4o' },
                          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                          { value: 'llama3', label: 'Llama 3' },
                        ]}
                        className={styles.select}
                      />
                    </div>
                  </div>
                </>
              )
            })()}

            {/* Cache Toggle */}
            <Divider className={styles.divider} />
            <div className={styles.settingRow}>
              <span className={styles.label}>启用缓存</span>
              <div className={styles.control}>
                <Switch
                  checked={modelApi.cacheEnabled || false}
                  onChange={(checked) =>
                    updateSetting('modelApi.cacheEnabled', checked)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* === Tab 2: 外观 === */}
        {activeTab === 'appearance' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>外观设置</h3>

            {/* Theme Selector */}
            <div className={styles.settingRow}>
              <span className={styles.label}>主题</span>
              <div className={styles.control}>
                <Select
                  value={appearance.theme}
                  onChange={(val) => updateSetting('appearance.theme', val)}
                  options={THEMES}
                  className={styles.select}
                />
              </div>
            </div>

            {/* Font Size Slider */}
            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>字体大小</span>
                <span className={styles.valueLabel}>{appearance.fontSize}px</span>
              </div>
              <div className={styles.control} style={{ flex: 1 }}>
                <Slider
                  min={12}
                  max={20}
                  value={appearance.fontSize}
                  onChange={(val) => updateSetting('appearance.fontSize', val)}
                />
              </div>
            </div>

            {/* Sidebar Collapsed Toggle */}
            <div className={styles.settingRow}>
              <span className={styles.label}>侧边栏收起</span>
              <div className={styles.control}>
                <Switch
                  checked={appearance.sidebarCollapsed}
                  onChange={(val) =>
                    updateSetting('appearance.sidebarCollapsed', val)
                  }
                />
              </div>
            </div>

            {/* Conversation Minimap Toggle */}
            <div className={styles.settingRow}>
              <span className={styles.label}>对话缩略图</span>
              <div className={styles.control}>
                <Switch
                  checked={appearance.conversationMinimapEnabled}
                  onChange={(val) =>
                    updateSetting('appearance.conversationMinimapEnabled', val)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* === Tab 3: 工作空间 === */}
        {activeTab === 'workspace' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>工作空间</h3>

            {/* Workspace Root Path */}
            <div className={styles.settingRow}>
              <span className={styles.label}>工作空间根路径</span>
              <div className={styles.control}>
                <Input
                  value={workspace.rootPath}
                  placeholder="选择工作空间目录..."
                  addonAfter="浏览"
                  className={styles.input}
                />
              </div>
            </div>

            {/* Recent Paths */}
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

            {/* Auto-save Toggle */}
            <div className={styles.settingRow}>
              <span className={styles.label}>自动保存</span>
              <div className={styles.control}>
                <Switch
                  checked={workspace.autoSave}
                  onChange={(val) => updateSetting('workspace.autoSave', val)}
                />
              </div>
            </div>

            {/* Auto-save Interval */}
            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>自动保存间隔</span>
                <span className={styles.valueLabel}>{workspace.autoSaveInterval}s</span>
              </div>
              <div className={styles.control} style={{ flex: 1 }}>
                <Slider
                  min={5}
                  max={300}
                  step={5}
                  value={workspace.autoSaveInterval}
                  onChange={(val) =>
                    updateSetting('workspace.autoSaveInterval', val)
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* === Tab 4: Agent 行为 === */}
        {activeTab === 'agent' && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Agent 行为</h3>

            {/* Default Permission Level */}
            <div className={styles.settingRow}>
              <span className={styles.label}>默认权限等级</span>
              <div className={styles.control}>
                <Select
                  value={agent.defaultPermission}
                  onChange={(val) =>
                    updateSetting('agent.defaultPermission', val)
                  }
                  options={PERMISSION_LEVELS}
                  className={styles.select}
                />
              </div>
            </div>

            {/* Default Mode */}
            <div className={styles.settingRow}>
              <span className={styles.label}>默认模式</span>
              <div className={styles.control}>
                <Select
                  value={agent.defaultMode}
                  onChange={(val) => updateSetting('agent.defaultMode', val)}
                  options={MODES}
                  className={styles.select}
                />
              </div>
            </div>

            {/* Max Steps */}
            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>最大步数</span>
                <span className={styles.valueLabel}>{agent.maxSteps}</span>
              </div>
              <div className={styles.control} style={{ flex: 1 }}>
                <Slider
                  min={1}
                  max={200}
                  value={agent.maxSteps}
                  onChange={(val) => updateSetting('agent.maxSteps', val)}
                />
              </div>
            </div>

            {/* Timeout */}
            <div className={styles.settingRow}>
              <div className={styles.fullLabelRow}>
                <span className={styles.label}>超时时间</span>
                <span className={styles.valueLabel}>{agent.timeout}s</span>
              </div>
              <div className={styles.control} style={{ flex: 1 }}>
                <InputNumber
                  min={10}
                  max={3600}
                  value={agent.timeout}
                  onChange={(val) =>
                    updateSetting('agent.timeout', val ?? 300)
                  }
                  className={styles.inputNumber}
                  addonAfter="秒"
                  style={{ width: '100%' }}
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
