// GeoWork Desktop - Write Mode Workspace

import { FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import styles from './WriteWorkspace.module.scss'

export default function WriteWorkspace() {
  return (
    <div className={styles.writeWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> 写作模式</h2>
          <span className="text-sm text-[var(--gw-text-tertiary)]">报告生成、文档编辑和结果导出</span>
        </div>

        <div className={styles.panels}>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>文档编辑器</CardTitle>
            </CardHeader>
            <CardContent>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Markdown 编辑器</pre>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>工件预览</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>生成的报告和工件预览。</p>
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>导出选项</CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>DOCX、PPTX、PDF、COG 导出。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
