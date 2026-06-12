// GeoWork Desktop - Research Mode Workspace

import { FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Empty } from '../components/ui/empty'
import styles from './ResearchWorkspace.module.scss'

export default function ResearchWorkspace() {
  return (
    <div className={styles.researchWorkspace}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> 研究模式</h2>
          <span className="text-sm text-[var(--gw-text-tertiary)]">文献搜索、知识索引和学术分析</span>
        </div>

        <div className={styles.panels}>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>知识索引</CardTitle>
            </CardHeader>
            <CardContent>
              <Empty title="暂无索引数据" />
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>论文搜索</CardTitle>
            </CardHeader>
            <CardContent>
              <Empty title="搜索论文和学术资源" />
            </CardContent>
          </Card>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle>文献矩阵</CardTitle>
            </CardHeader>
            <CardContent>
              <Empty title="文献对比矩阵" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
