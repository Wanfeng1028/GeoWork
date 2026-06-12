import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { toast } from 'sonner'
import useSettingsStore from '../../stores/settingsStore'
import styles from './Settings.module.scss'

export function SettingsPage() {
  const { settings, setTheme } = useSettingsStore()
  const [formData, setFormData] = useState(settings)

  const handleSave = async () => {
    try {
      toast.success('设置已保存')
    } catch (error) {
      toast.error('保存设置失败')
    }
  }

  return (
    <div className={styles.settings}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>模型与 API</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">默认提供商</label>
              <Select value={formData.modelApi?.defaultProvider} onValueChange={(v) => setFormData({ ...formData, modelApi: { ...formData.modelApi, defaultProvider: v } })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  {settings.modelApi.providers.map((provider: any) => (
                    <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.modelApi?.cacheEnabled} onCheckedChange={(v) => setFormData({ ...formData, modelApi: { ...formData.modelApi, cacheEnabled: v } })} />
              <label className="text-sm font-medium">启用缓存</label>
            </div>
            {settings.modelApi.providers.map((provider: any) => (
              <Card key={provider.id} className={styles.providerCard}>
                <CardContent>
                  <h4>{provider.name}</h4>
                  <div className="space-y-2 mt-2">
                    <div>
                      <label className="text-sm font-medium">Base URL</label>
                      <Input defaultValue={provider.baseUrl} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">默认模型</label>
                      <Input defaultValue={provider.defaultModel} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch defaultChecked={provider.enabled} />
                      <label className="text-sm font-medium">启用</label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>外观</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">主题</label>
              <Select onValueChange={(value) => { setTheme(value); toast.success('外观主题已更新') }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择主题" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">深色</SelectItem>
                  <SelectItem value="light">浅色</SelectItem>
                  <SelectItem value="system">跟随系统</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">字体大小</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择字体大小" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12px</SelectItem>
                  <SelectItem value="14">14px</SelectItem>
                  <SelectItem value="16">16px</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch />
              <label className="text-sm font-medium">对话缩略图</label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>工作区</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">工作区路径</label>
              <Input placeholder="选择工作区根目录" />
            </div>
            <div className="flex items-center gap-2">
              <Switch />
              <label className="text-sm font-medium">自动保存</label>
            </div>
            <div>
              <label className="text-sm font-medium">自动保存间隔 (秒)</label>
              <Input type="number" min={10} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Agent 行为</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">默认权限级别</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择权限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">完全</SelectItem>
                  <SelectItem value="limited">受限</SelectItem>
                  <SelectItem value="sandbox">沙箱</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">默认模式</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="选择模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Research">Research</SelectItem>
                  <SelectItem value="Data">Data</SelectItem>
                  <SelectItem value="GeoCode">GeoCode</SelectItem>
                  <SelectItem value="Analysis">Analysis</SelectItem>
                  <SelectItem value="Write">Write</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">最大步骤数</label>
              <Input type="number" min={10} />
            </div>
            <div>
              <label className="text-sm font-medium">超时时间 (秒)</label>
              <Input type="number" min={60} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={styles.actions}>
        <Button size="lg" onClick={handleSave}>保存设置</Button>
        <Button size="lg" variant="outline">重置</Button>
      </div>
    </div>
  )
}
