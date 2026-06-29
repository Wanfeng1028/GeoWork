import { useState } from 'react'
import { ArrowLeft, Bot, ChevronRight, FolderOpen, KeyRound, Palette, Settings as SettingsIcon, Shield, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import useSettingsStore from '../../stores/settingsStore'
import styles from './Settings.module.scss'

const TABS = [
  { key: 'model', label: '模型与 API', icon: KeyRound },
  { key: 'appearance', label: '外观', icon: Palette },
  { key: 'workspace', label: '工作区', icon: FolderOpen },
  { key: 'agent', label: 'Agent 行为', icon: Bot },
]

const THEMES: { value: GeoWorkTheme; label: string }[] = [
  { value: 'dark', label: '深色 · 默认' },
  { value: 'light', label: '浅色' },
  { value: 'auto', label: '跟随系统' },
  { value: 'dark-glass', label: '深色 · 清透' },
  { value: 'light-glass', label: '浅色 · 清透' },
  { value: 'classic-dark', label: '深色 · 经典' },
  { value: 'classic-light', label: '浅色 · 经典' },
  { value: 'dark-parchment', label: '深色 · 羊皮纸' },
  { value: 'light-parchment', label: '浅色 · 羊皮纸' },
]

export function SettingsPage() {
  const { settings, setTheme } = useSettingsStore()
  const [activeTab, setActiveTab] = useState('model')
  const current = TABS.find((tab) => tab.key === activeTab) ?? TABS[0]

  return (
    <div className={styles.settingsPage}>
      <div className={styles.settingsShell}>
        <nav className={styles.settingsNav}>
          <button className={styles.settingsBack} onClick={() => history.back()}>
            <ArrowLeft size={14} />
            设置
          </button>
          <div className={styles.settingsGroup}>
            <span>常规</span>
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button key={tab.key} className={isActive ? styles.active : ''} onClick={() => setActiveTab(tab.key)}>
                  <span className={styles.settingsNavLabel}><Icon size={14} />{tab.label}</span>
                  <ChevronRight size={13} />
                </button>
              )
            })}
          </div>
          <div className={styles.settingsGroup}>
            <span>支持</span>
            <button><span className={styles.settingsNavLabel}><Shield size={14} />隐私与安全</span><ChevronRight size={13} /></button>
            <button><span className={styles.settingsNavLabel}><SlidersHorizontal size={14} />实验功能</span><em>Beta</em></button>
          </div>
        </nav>

        <main className={styles.settingsPanel}>
          <div className={styles.settingsTitle}>
            <h1>{current.label}</h1>
            <p>这些设置仅影响本地桌面端前端体验，与 GeoWork 的业务结构保持分离。</p>
          </div>

          {activeTab === 'model' && (
            <div className={styles.settingsStack}>
              <Section title="默认配置" icon={<SettingsIcon size={15} />}>
                <SettingRow label="默认提供商" description="用于新建任务的默认模型服务。">
                  <Select>
                    <SelectTrigger><SelectValue placeholder="选择提供商" /></SelectTrigger>
                    <SelectContent>
                      {settings.modelApi.providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <SettingRow label="启用缓存" description="缓存模型配置和短期响应上下文。"><Switch /></SettingRow>
              </Section>

              {settings.modelApi.providers.map((provider: any) => (
                <Section key={provider.id} title={provider.name} icon={<KeyRound size={15} />}>
                  <SettingRow label="Base URL"><Input defaultValue={provider.baseUrl} placeholder="https://api.example.com/v1" /></SettingRow>
                  <SettingRow label="默认模型"><Input defaultValue={provider.defaultModel} placeholder="gpt-4o" /></SettingRow>
                  <SettingRow label="启用"><Switch defaultChecked={provider.enabled} /></SettingRow>
                </Section>
              ))}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className={styles.settingsStack}>
              <Section title="主题" icon={<Palette size={15} />}>
                <div className={styles.themeGrid}>
                  {THEMES.map((theme) => (
                    <button
                      key={theme.value}
                      className={settings.appearance.theme === theme.value ? styles.selectedTheme : ''}
                      onClick={() => { setTheme(theme.value); toast.success('主题已更新') }}
                    >
                      <span data-theme-preview={theme.value} />
                      <em>{theme.label}</em>
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="显示" icon={<SlidersHorizontal size={15} />} compact>
                <SettingRow label="字体大小" description="默认字体大小。"><span className={styles.settingValue}>14px</span></SettingRow>
                <SettingRow label="对话缩略图"><Switch /></SettingRow>
                <SettingRow label="紧凑侧栏"><Switch /></SettingRow>
              </Section>
            </div>
          )}

          {activeTab === 'workspace' && (
            <Section title="工作区" icon={<FolderOpen size={15} />}>
              <SettingRow label="工作区路径"><Input placeholder="选择工作区根目录" /></SettingRow>
              <SettingRow label="自动保存"><Switch /></SettingRow>
              <SettingRow label="自动保存间隔"><Input type="number" min={10} placeholder="300" /></SettingRow>
            </Section>
          )}

          {activeTab === 'agent' && (
            <Section title="Agent 行为" icon={<Bot size={15} />}>
              <SettingRow label="默认权限级别">
                <Select>
                  <SelectTrigger><SelectValue placeholder="选择权限" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">完全</SelectItem>
                    <SelectItem value="limited">受限</SelectItem>
                    <SelectItem value="sandbox">沙箱</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="默认模式"><span className={styles.settingValue}>General</span></SettingRow>
              <SettingRow label="最大步骤数"><Input type="number" min={10} placeholder="200" /></SettingRow>
              <SettingRow label="超时时间"><Input type="number" min={60} placeholder="300" /></SettingRow>
            </Section>
          )}
        </main>
      </div>
    </div>
  )
}

function Section({ title, icon, children, compact = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={`${styles.settingsCard} ${compact ? styles.compact : ''}`}>
      <div className={styles.settingHead}>{icon}<div><strong>{title}</strong><span>本地设置，立即生效</span></div></div>
      {children}
    </section>
  )
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div><strong>{label}</strong>{description && <span>{description}</span>}</div>
      <div className={styles.settingControl}>{children}</div>
    </div>
  )
}
