// GeoWork GeoComposer

import { useState } from 'react'
import { Button, Select, Space } from 'antd'
import { PlayCircleOutlined, CodeOutlined, ExperimentOutlined, SettingOutlined } from '@ant-design/icons'
import styles from './GeoComposer.module.scss'

export function GeoComposer() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('Analysis')

  return (
    <div className={styles.composer}>
      <div className={styles.toolbar}>
        <Select
          value={mode}
          onChange={setMode}
          size="small"
          className={styles.modeSelect}
          options={[
            { label: 'Research', value: 'Research' },
            { label: 'Data', value: 'Data' },
            { label: 'GeoCode', value: 'GeoCode' },
            { label: 'Analysis', value: 'Analysis' },
            { label: 'Write', value: 'Write' }
          ]}
        />
        
        <Space size="small">
          <Button size="small" icon={<CodeOutlined />}>查看脚本</Button>
          <Button size="small" icon={<ExperimentOutlined />}>运行分析</Button>
        </Space>
      </div>
      
      <textarea
        className={styles.textarea}
        placeholder="描述你的地理遥感任务，例如：请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      
      <div className={styles.actions}>
        <Button 
          type="primary" 
          icon={<PlayCircleOutlined />}
          className={styles.primaryBtn}
        >
          创建并执行任务
        </Button>
        
        <Button size="small" icon={<SettingOutlined />}>
          高级设置
        </Button>
      </div>
    </div>
  )
}
