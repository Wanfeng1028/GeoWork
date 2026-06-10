// GeoWork Settings Page

import { Card, Form, Input, Select, Switch, Space, Button, message } from 'antd'
import type { Settings as SettingsType } from '../types/settings'
import { mockSettings } from '../mocks/settings.mock'
import useSettingsStore from '../stores/settingsStore'
import styles from './Settings.module.scss'

const { TextArea } = Input

export function SettingsPage() {
  const { settings, isLoading } = useSettingsStore()
  const [form] = Form.useForm()

  const handleSave = async (values: any) => {
    try {
      // TODO: Save settings to backend
      message.success('设置已保存')
    } catch (error) {
      message.error('保存设置失败')
    }
  }

  return (
    <div className={styles.settings}>
      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onFinish={handleSave}
      >
        <Card title="模型与 API" className={styles.card}>
          <Form.Item name={['modelApi', 'defaultProvider']} label="默认提供商">
            <Select>
              {settings.modelApi.providers.map((provider: any) => (
                <Select.Option key={provider.id} value={provider.id}>
                  {provider.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name={['modelApi', 'cacheEnabled']} label="启用缓存">
            <Switch />
          </Form.Item>
          
          {settings.modelApi.providers.map((provider: any, index: number) => (
            <Card key={provider.id} size="small" className={styles.providerCard}>
              <h4>{provider.name}</h4>
              <Form.Item label="Base URL">
                <Input value={provider.baseUrl} />
              </Form.Item>
              <Form.Item label="默认模型">
                <Input value={provider.defaultModel} />
              </Form.Item>
              <Form.Item label="启用">
                <Switch checked={provider.enabled} />
              </Form.Item>
            </Card>
          ))}
        </Card>
        
        <Card title="外观" className={styles.card}>
          <Form.Item name={['appearance', 'theme']} label="主题">
            <Select>
              <Select.Option value="dark-geo">深色地理</Select.Option>
              <Select.Option value="light-geo">浅色地理</Select.Option>
              <Select.Option value="dark-glass">深色玻璃</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name={['appearance', 'fontSize']} label="字体大小">
            <Select>
              <Select.Option value={12}>12px</Select.Option>
              <Select.Option value={14}>14px</Select.Option>
              <Select.Option value={16}>16px</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name={['appearance', 'conversationMinimapEnabled']} label="对话缩略图">
            <Switch />
          </Form.Item>
        </Card>
        
        <Card title="工作区" className={styles.card}>
          <Form.Item name={['workspace', 'rootPath']} label="工作区路径">
            <Input placeholder="选择工作区根目录" />
          </Form.Item>
          
          <Form.Item name={['workspace', 'autoSave']} label="自动保存">
            <Switch />
          </Form.Item>
          
          <Form.Item name={['workspace', 'autoSaveInterval']} label="自动保存间隔 (秒)">
            <Input type="number" min={10} />
          </Form.Item>
        </Card>
        
        <Card title="Agent 行为" className={styles.card}>
          <Form.Item name={['agent', 'defaultPermission']} label="默认权限级别">
            <Select>
              <Select.Option value="full">完全</Select.Option>
              <Select.Option value="limited">受限</Select.Option>
              <Select.Option value="sandbox">沙箱</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name={['agent', 'defaultMode']} label="默认模式">
            <Select>
              <Select.Option value="Research">Research</Select.Option>
              <Select.Option value="Data">Data</Select.Option>
              <Select.Option value="GeoCode">GeoCode</Select.Option>
              <Select.Option value="Analysis">Analysis</Select.Option>
              <Select.Option value="Write">Write</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item name={['agent', 'maxSteps']} label="最大步骤数">
            <Input type="number" min={10} />
          </Form.Item>
          
          <Form.Item name={['agent', 'timeout']} label="超时时间 (秒)">
            <Input type="number" min={60} />
          </Form.Item>
        </Card>
        
        <div className={styles.actions}>
          <Button type="primary" htmlType="submit" size="large">
            保存设置
          </Button>
          <Button size="large">重置</Button>
        </div>
      </Form>
    </div>
  )
}
