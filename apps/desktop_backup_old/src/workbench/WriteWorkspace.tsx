// GeoWork Desktop - Write Mode Workspace

import { FileText } from 'lucide-react'
import styles from './WriteWorkspace.module.scss'

export default function WriteWorkspace() {
  return (
    <div className={styles.writeWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 ><FileText  /> 写作模式</h2>
          <span >报告生成、文档编辑和结果导出</span>
        </div>

        <div className={styles.panels}>
          <div className={styles.panel}>
            <div>
              <div>文档编辑器</div>
            </div>
            <div>
              <pre style={{ color: '#8c97a1', fontSize: 13, margin: 0 }}># Markdown 编辑器</pre>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>工件预览</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>生成的报告和工件预览。</p>
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>导出选项</div>
            </div>
            <div>
              <p style={{ color: '#8c97a1', fontSize: 13 }}>DOCX、PPTX、PDF、COG 导出。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
