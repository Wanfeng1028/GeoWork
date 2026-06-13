import { GeoAgentWordmark, GeoMascot, type GeoMascotGender } from './GeoMascot'

const expressions = ['happy', 'thinking', 'focus', 'surprise', 'wink'] as const
const actions = ['analyze-data', 'execute-task', 'discover-insight', 'generate-result', 'complete-ok'] as const
const degrees = ['bachelor', 'master', 'doctor'] as const
const views = ['front', 'side', 'back'] as const

export function GeoAgentCharacterGallery({ gender = 'girl' }: { gender?: GeoMascotGender }) {
  return (
    <section style={{ padding: 24, color: '#0B1A3D' }}>
      <GeoAgentWordmark height={60} />
      <h2>GeoWork Agent 角色资源预览</h2>
      <h3>表情 / Expressions</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {expressions.map((expression) => <GeoMascot key={expression} size={96} gender={gender} expression={expression} animated={false} />)}
      </div>
      <h3>动作 / Actions</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {actions.map((action) => <GeoMascot key={action} size={110} gender={gender} action={action} animated={false} />)}
      </div>
      <h3>学士 / 硕士 / 博士 + 三视图</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: 18 }}>
        {degrees.flatMap((degree) => views.map((view) => <GeoMascot key={`${degree}-${view}`} size={110} gender={gender} degree={degree} view={view} animated={false} />))}
      </div>
    </section>
  )
}
