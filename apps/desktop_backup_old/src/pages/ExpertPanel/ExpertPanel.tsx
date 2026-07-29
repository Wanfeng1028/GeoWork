import React, { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Sparkles, Search, Plus, SlidersHorizontal, Bot } from 'lucide-react'
import ExpertCard, { type ExpertItem, type ExpertSkill } from './ExpertCard'
import styles from './ExpertPanel.module.scss'

export interface ExpertPanelProps {
  experts?: ExpertItem[]
  loading?: boolean
  onExpertCall?: (expert: ExpertItem) => void
}

const DEFAULT_SKILLS: Record<string, ExpertSkill[]> = {
  '总控专家': [
    { id: 's1', name: '任务规划', description: '将复杂任务拆解为可执行的子任务' },
    { id: 's2', name: '协调调度', description: '协调多个专家协同工作' },
    { id: 's3', name: '进度跟踪', description: '跟踪任务执行进度和状态' },
  ],
  '论文专家': [
    { id: 's4', name: '论文搜索', description: '在 OpenAlex 等数据库中搜索论文' },
    { id: 's5', name: '文献综述', description: '生成文献综述报告' },
    { id: 's6', name: '引用分析', description: '分析论文引用关系' },
  ],
  '数据专家': [
    { id: 's7', name: '数据下载', description: '从 GEE/USGS 下载遥感数据' },
    { id: 's8', name: '数据预处理', description: '辐射校正、大气校正等' },
    { id: 's9', name: '数据格式转换', description: 'GeoTIFF/Shapefile/NetCDF 互转' },
  ],
  'GEE 专家': [
    { id: 's10', name: 'GEE 脚本生成', description: '生成 Google Earth Engine JavaScript/Python 脚本' },
    { id: 's11', name: '影像处理', description: 'GEE 影像筛选、合成、裁剪' },
    { id: 's12', name: '时间序列分析', description: 'GEE 时间序列分析' },
  ],
  'QGIS 专家': [
    { id: 's13', name: 'QGIS 自动化', description: '使用 PyQGIS 自动化处理流程' },
    { id: 's14', name: '图层管理', description: '图层样式、投影管理' },
    { id: 's15', name: '空间处理', description: '缓冲区、叠加分析等' },
  ],
  '遥感分析专家': [
    { id: 's16', name: 'NDVI 分析', description: '归一化植被指数计算与分析' },
    { id: 's17', name: '地表温度反演', description: '单窗/双温算法反演' },
    { id: 's18', name: '变化检测', description: '多时相遥感变化检测' },
  ],
  'GIS 工程专家': [
    { id: 's19', name: '空间分析', description: '叠加、缓冲区、网络分析' },
    { id: 's20', name: '空间统计', description: '莫兰指数、回归分析' },
    { id: 's21', name: '三维可视化', description: 'DEM 三维渲染' },
  ],
  '地图制图专家': [
    { id: 's22', name: '专题地图', description: '生成各类专题地图' },
    { id: 's23', name: '图例设计', description: '专业图例样式设计' },
    { id: 's24', name: '地图输出', description: '导出高分辨率地图' },
  ],
  '实验报告专家': [
    { id: 's25', name: '报告生成', description: '自动生成实验报告 DOCX' },
    { id: 's26', name: '图表插入', description: '自动插入分析图表' },
    { id: 's27', name: '结果讨论', description: '生成结果分析与讨论' },
  ],
  '论文写作专家': [
    { id: 's28', name: '论文撰写', description: '根据实验结果撰写论文' },
    { id: 's29', name: '格式调整', description: '按期刊格式调整论文' },
    { id: 's30', name: '摘要生成', description: '生成中英文摘要' },
  ],
  '质量检查专家': [
    { id: 's31', name: '结果验证', description: '验证分析结果的正确性' },
    { id: 's32', name: '精度评估', description: '精度验证与误差分析' },
    { id: 's33', name: '数据一致性', description: '检查数据一致性' },
  ],
  '代码审查专家': [
    { id: 's34', name: '代码质量', description: '检查代码质量和规范' },
    { id: 's35', name: '性能优化', description: '优化代码性能' },
    { id: 's36', name: '安全审查', description: '检查代码安全隐患' },
  ],
}

const EXPERT_CATEGORIES = ['全部', '核心', '数据处理', '分析', '写作', '工程']

const EXPERT_CONFIGS: Omit<ExpertItem, 'skills'>[] = [
  { id: 'e1', name: '总控专家', description: '任务规划和协调，负责将复杂任务拆解为可执行的子任务，协调多个专家协同工作', icon: <Bot size={18} />, color: '', category: '核心' },
  { id: 'e2', name: '论文专家', description: '论文搜索和综述，在 OpenAlex 等数据库中搜索相关论文，生成文献综述报告', icon: <Sparkles size={18} />, color: '', category: '写作' },
  { id: 'e3', name: '数据专家', description: '遥感数据处理，负责数据下载、预处理、格式转换等全流程数据处理', icon: <Bot size={18} />, color: '', category: '数据处理' },
  { id: 'e4', name: 'GEE 专家', description: 'Google Earth Engine 专家，生成 GEE 脚本，处理影像数据，进行时间序列分析', icon: <Bot size={18} />, color: '', category: '数据处理' },
  { id: 'e5', name: 'QGIS 专家', description: 'QGIS 自动化，使用 PyQGIS 自动化处理流程，管理图层和空间处理', icon: <Bot size={18} />, color: '', category: '工程' },
  { id: 'e6', name: '遥感分析专家', description: '遥感算法专家，执行 NDVI 分析、地表温度反演、变化检测等遥感分析', icon: <Bot size={18} />, color: '', category: '分析' },
  { id: 'e7', name: 'GIS 工程专家', description: '空间分析专家，执行叠加分析、缓冲区分析、空间统计和三维可视化', icon: <Bot size={18} />, color: '', category: '工程' },
  { id: 'e8', name: '地图制图专家', description: '地图输出专家，生成专题地图，设计专业图例，导出高分辨率地图', icon: <Bot size={18} />, color: '', category: '工程' },
  { id: 'e9', name: '实验报告专家', description: '实验报告生成，自动生成 DOCX 报告，插入分析图表，生成结果讨论', icon: <Bot size={18} />, color: '', category: '写作' },
  { id: 'e10', name: '论文写作专家', description: '论文撰写专家，根据实验结果撰写论文，按期刊格式调整，生成中英文摘要', icon: <Bot size={18} />, color: '', category: '写作' },
  { id: 'e11', name: '质量检查专家', description: '结果验证专家，验证分析结果正确性，进行精度验证和误差分析', icon: <Bot size={18} />, color: '', category: '分析' },
  { id: 'e12', name: '代码审查专家', description: '代码质量专家，检查代码质量和规范，优化代码性能，审查安全隐患', icon: <Bot size={18} />, color: '', category: '分析' },
]

export default function ExpertPanel({
  experts = EXPERT_CONFIGS.map((config) => ({
    ...config,
    skills: DEFAULT_SKILLS[config.name] ?? [],
  })),
  loading = false,
  onExpertCall,
}: ExpertPanelProps) {
  const [selectedExpert, setSelectedExpert] = useState<ExpertItem | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')

  const filteredExperts = React.useMemo(() => {
    return experts.filter((expert) => {
      const matchesSearch =
        searchText === '' ||
        expert.name.includes(searchText) ||
        expert.description.includes(searchText) ||
        expert.skills.some((s) => s.name.includes(searchText))
      const matchesCategory = activeCategory === '全部' || expert.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [experts, searchText, activeCategory])

  const handleExpertClick = useCallback((expert: ExpertItem) => {
    setSelectedExpert(expert)
    setModalVisible(true)
  }, [])

  const handleExpertCall = useCallback(
    (expert: ExpertItem) => {
      if (onExpertCall) {
        onExpertCall(expert)
      } else {
        toast.success(`正在调用 ${expert.name}...`)
      }
    },
    [onExpertCall],
  )

  const handleModalCall = useCallback(() => {
    if (selectedExpert) {
      handleExpertCall(selectedExpert)
      setModalVisible(false)
    }
  }, [selectedExpert, handleExpertCall])

  if (loading) {
    return <div className={styles.panel}><div className={styles.emptyState}>加载专家中…</div></div>
  }

  return (
    <div className={styles.panel}>
      {/* Top toolbar */}
      <div className={styles.topBar}>
        <button className={styles.refresh} title="刷新">
          <Sparkles size={14} />
        </button>
        <div className={styles.searchField}>
          <Search size={14} />
          <input
            className={styles.searchInput}
            placeholder="搜索专家、技能..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <h1 className={styles.title}>专家面板</h1>
        <p className={styles.subtitle}>
          12 位内置专家，覆盖遥感分析、GIS 工程、论文写作等全链路地理空间任务。
        </p>

        {/* Hero */}
        <div className={styles.hero}>
          <div>
            <strong>为你精选的地理空间专家</strong>
            <span>覆盖遥感、GIS、数据处理、学术写作等多种场景，一键调用。</span>
          </div>
        </div>

        {/* Filter row */}
        <div className={styles.filterRow}>
          <div className={styles.tabs}>
            {EXPERT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={activeCategory === cat ? styles.active : ''}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <button>
              <SlidersHorizontal size={13} />全部
            </button>
            <button>排序: 推荐</button>
          </div>
        </div>

        <p className={styles.sectionLabel}>官方精选</p>

        {/* Grid */}
        {filteredExperts.length > 0 ? (
          <div className={styles.grid}>
            {filteredExperts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} onCall={handleExpertClick} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>没有找到匹配的专家，请调整搜索条件</div>
        )}
      </div>

      {/* Floating avatar */}
      <button className={styles.avatarFloat} title="账户">
        G
      </button>

      {/* Detail modal */}
      <div>
        <div >
          {selectedExpert && (
            <div className={styles.modalBody}>
              <div>
                <strong style={{ fontSize: 18 }}>{selectedExpert.name}</strong>
                <span className={styles.modalDesc} style={{ display: 'block', marginTop: 4 }}>
                  {selectedExpert.description}
                </span>
              </div>
              <div className={styles.modalSkills}>
                {selectedExpert.skills.map((skill) => (
                  <div key={skill.id} className={styles.modalSkill}>
                    <strong>{skill.name}</strong>
                    <span>{skill.description}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleModalCall}>
                <Bot size={14} /> 调用 {selectedExpert.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
