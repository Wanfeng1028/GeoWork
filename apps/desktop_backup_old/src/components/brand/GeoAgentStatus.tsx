import { GeoMascot, type GeoMascotGender, type GeoMascotState } from './GeoMascot'

const labelMap: Record<GeoMascotState, string> = {
  idle: '待机',
  thinking: '思考中',
  working: '执行中',
  celebrating: '已完成',
  analyzing: '分析中',
  discovering: '发现洞察',
  complete: '完成',
  error: '需要处理',
}

export function GeoAgentStatus({ state = 'idle', gender = 'girl' }: { state?: GeoMascotState; gender?: GeoMascotGender }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <GeoMascot size="lg" state={state} gender={gender} />
      <span style={{ color: '#0B1A3D', fontWeight: 800 }}>{labelMap[state]}</span>
    </div>
  )
}
