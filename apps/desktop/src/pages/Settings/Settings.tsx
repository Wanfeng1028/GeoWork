import { useState } from 'react'
import { Settings as SettingsIcon, Palette, FolderOpen, Bot } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Separator } from '../../components/ui/separator'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { toast } from 'sonner'
import useSettingsStore from '../../stores/settingsStore'
import type { Settings } from '../../types/settings'

const TABS = [
  { key: 'model', label: '模型与 API', icon: SettingsIcon },
  { key: 'appearance', label: '外观', icon: Palette },
  { key: 'workspace', label: '工作区', icon: FolderOpen },
  { key: 'agent', label: 'Agent 行为', icon: Bot },
]

export function SettingsPage() {
  const { settings, setTheme } = useSettingsStore()
  const [activeTab, setActiveTab] = useState('model')

  return (
    <div className="h-full flex overflow-hidden">
      {/* Tab sidebar */}
      <div className="w-[200px] shrink-0 border-r border-[var(--gw-border-soft)] bg-[var(--gw-bg-shell)] p-3 flex flex-col gap-0.5">
        <div className="text-[13px] font-bold text-[var(--gw-text)] px-2 py-2 mb-2">设置</div>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              className={`w-full flex items-center gap-2 h-[32px] px-2.5 rounded-lg text-[12px] cursor-pointer transition-all ${
                isActive
                  ? 'bg-[var(--gw-accent-soft)] text-[var(--gw-accent)]'
                  : 'text-[var(--gw-text-secondary)] hover:bg-[var(--gw-bg-hover)] hover:text-[var(--gw-text)]'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[720px]">
          {activeTab === 'model' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-bold text-[var(--gw-text)]">模型与 API</h2>

              <section className="rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] p-5">
                <h3 className="text-[14px] font-semibold text-[var(--gw-text)] mb-4">默认配置</h3>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">默认提供商</label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="选择提供商" /></SelectTrigger>
                      <SelectContent>
                        {settings.modelApi.providers.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">启用缓存</label>
                    <Switch />
                  </div>
                </div>
              </section>

              {settings.modelApi.providers.map((provider: any) => (
                <section key={provider.id} className="rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] p-5">
                  <h3 className="text-[14px] font-semibold text-[var(--gw-text)] mb-4">{provider.name}</h3>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                      <label className="text-[12px] text-[var(--gw-text-secondary)]">Base URL</label>
                      <Input defaultValue={provider.baseUrl} placeholder="https://api.example.com/v1" />
                    </div>
                    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                      <label className="text-[12px] text-[var(--gw-text-secondary)]">默认模型</label>
                      <Input defaultValue={provider.defaultModel} placeholder="gpt-4o" />
                    </div>
                    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                      <label className="text-[12px] text-[var(--gw-text-secondary)]">启用</label>
                      <Switch defaultChecked={provider.enabled} />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-bold text-[var(--gw-text)]">外观</h2>
              <section className="rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">主题</label>
                    <Select onValueChange={(v) => { setTheme(v as Settings['appearance']['theme']); toast.success('主题已更新') }}>
                      <SelectTrigger><SelectValue placeholder="选择主题" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">深色</SelectItem>
                        <SelectItem value="light">浅色</SelectItem>
                        <SelectItem value="system">跟随系统</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">字体大小</label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="选择字体大小" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12px</SelectItem>
                        <SelectItem value="14">14px</SelectItem>
                        <SelectItem value="16">16px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">对话缩略图</label>
                    <Switch />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-bold text-[var(--gw-text)]">工作区</h2>
              <section className="rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">工作区路径</label>
                    <Input placeholder="选择工作区根目录" />
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">自动保存</label>
                    <Switch />
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">自动保存间隔</label>
                    <Input type="number" min={10} placeholder="300" />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-[18px] font-bold text-[var(--gw-text)]">Agent 行为</h2>
              <section className="rounded-xl border border-[var(--gw-border-soft)] bg-[var(--gw-bg-panel)] p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">默认权限级别</label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="选择权限" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">完全</SelectItem>
                        <SelectItem value="limited">受限</SelectItem>
                        <SelectItem value="sandbox">沙箱</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">默认模式</label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="选择模式" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Research">Research</SelectItem>
                        <SelectItem value="Data">Data</SelectItem>
                        <SelectItem value="GeoCode">GeoCode</SelectItem>
                        <SelectItem value="Analysis">Analysis</SelectItem>
                        <SelectItem value="Write">Write</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">最大步骤数</label>
                    <Input type="number" min={10} placeholder="200" />
                  </div>
                  <div className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <label className="text-[12px] text-[var(--gw-text-secondary)]">超时时间 (秒)</label>
                    <Input type="number" min={60} placeholder="300" />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
