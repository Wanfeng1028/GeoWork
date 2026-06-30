// GeoWork Desktop - Research Mode Workspace

import { FileText } from 'lucide-react'
import styles from './ResearchWorkspace.module.scss'

export default function ResearchWorkspace() {
  return (
    <div className={styles.researchWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 ><FileText  /> 研究模式</h2>
          <span >文献搜索、知识索引和学术分析</span>
        </div>

        <div className={styles.panels}>
          <div className={styles.panel}>
            <div>
              <div>知识索引</div>
            </div>
            <div>
              <div />
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>论文搜索</div>
            </div>
            <div>
              <div />
            </div>
          </div>
          <div className={styles.panel}>
            <div>
              <div>文献矩阵</div>
            </div>
            <div>
              <div />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
