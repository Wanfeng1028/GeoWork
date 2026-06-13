import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'

export type GeoMascotSize = 'sm' | 'md' | 'lg' | 'xl' | number
export type GeoMascotGender = 'girl' | 'boy'
export type GeoMascotState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'celebrating'
  | 'analyzing'
  | 'discovering'
  | 'complete'
  | 'error'
export type GeoMascotExpression = 'happy' | 'thinking' | 'focus' | 'surprise' | 'wink'
export type GeoMascotAction = 'analyze-data' | 'execute-task' | 'discover-insight' | 'generate-result' | 'complete-ok'
export type GeoMascotDegree = 'bachelor' | 'master' | 'doctor'
export type GeoMascotView = 'front' | 'side' | 'back'
export type GeoMascotVariant = 'auto' | 'base' | 'expression' | 'action' | 'degree' | 'turnaround' | 'sticker'

interface GeoMascotProps {
  /** 兼容旧版：sm/md/lg/xl；也支持直接传像素数值。 */
  size?: GeoMascotSize
  /** girl = 小 Gea；boy = 小 Geo。 */
  gender?: GeoMascotGender
  /** 兼容旧版 state，并映射到新表情/动作素材。 */
  state?: GeoMascotState
  variant?: GeoMascotVariant
  expression?: GeoMascotExpression
  action?: GeoMascotAction
  degree?: GeoMascotDegree
  view?: GeoMascotView
  sticker?: 'hi' | 'thinking' | 'found' | 'locked' | 'need-help' | 'ok'
  className?: string
  style?: CSSProperties
  alt?: string
  animated?: boolean
}

const sizeMap = { sm: 32, md: 48, lg: 64, xl: 96 }

const svgModules = import.meta.glob('../../assets/brand/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function asset(path: string) {
  const key = `../../assets/brand/${path}`
  const found = svgModules[key]
  if (!found) {
    console.warn(`[GeoMascot] missing asset: ${key}`)
    return ''
  }
  return found
}

export const geoAgentCharacterAssets = {
  logo: {
    mark: asset('logo/geowork-logo-mark.svg'),
    wordmark: asset('logo/geowork-wordmark.svg'),
  },
  character: {
    girl: {
      base: asset('characters/girl/base.svg'),
      expressions: {
        happy: asset('characters/girl/expressions/happy.svg'),
        thinking: asset('characters/girl/expressions/thinking.svg'),
        focus: asset('characters/girl/expressions/focus.svg'),
        surprise: asset('characters/girl/expressions/surprise.svg'),
        wink: asset('characters/girl/expressions/wink.svg'),
      },
      actions: {
        'analyze-data': asset('characters/girl/actions/analyze-data.svg'),
        'execute-task': asset('characters/girl/actions/execute-task.svg'),
        'discover-insight': asset('characters/girl/actions/discover-insight.svg'),
        'generate-result': asset('characters/girl/actions/generate-result.svg'),
        'complete-ok': asset('characters/girl/actions/complete-ok.svg'),
      },
      degrees: {
        bachelor: { front: asset('characters/girl/degrees/bachelor-front.svg'), side: asset('characters/girl/degrees/bachelor-side.svg'), back: asset('characters/girl/degrees/bachelor-back.svg') },
        master: { front: asset('characters/girl/degrees/master-front.svg'), side: asset('characters/girl/degrees/master-side.svg'), back: asset('characters/girl/degrees/master-back.svg') },
        doctor: { front: asset('characters/girl/degrees/doctor-front.svg'), side: asset('characters/girl/degrees/doctor-side.svg'), back: asset('characters/girl/degrees/doctor-back.svg') },
      },
      turnaround: { front: asset('characters/girl/turnaround/front.svg'), side: asset('characters/girl/turnaround/side.svg'), back: asset('characters/girl/turnaround/back.svg') },
      stickers: {
        hi: asset('stickers/girl-hi.svg'),
        thinking: asset('stickers/girl-thinking.svg'),
        found: asset('stickers/girl-found.svg'),
        locked: asset('stickers/girl-locked.svg'),
        'need-help': asset('stickers/girl-need-help.svg'),
        ok: asset('stickers/girl-ok.svg'),
      },
    },
    boy: {
      base: asset('characters/boy/base.svg'),
      expressions: {
        happy: asset('characters/boy/expressions/happy.svg'),
        thinking: asset('characters/boy/expressions/thinking.svg'),
        focus: asset('characters/boy/expressions/focus.svg'),
        surprise: asset('characters/boy/expressions/surprise.svg'),
        wink: asset('characters/boy/expressions/wink.svg'),
      },
      actions: {
        'analyze-data': asset('characters/boy/actions/analyze-data.svg'),
        'execute-task': asset('characters/boy/actions/execute-task.svg'),
        'discover-insight': asset('characters/boy/actions/discover-insight.svg'),
        'generate-result': asset('characters/boy/actions/generate-result.svg'),
        'complete-ok': asset('characters/boy/actions/complete-ok.svg'),
      },
      degrees: {
        bachelor: { front: asset('characters/boy/degrees/bachelor-front.svg'), side: asset('characters/boy/degrees/bachelor-side.svg'), back: asset('characters/boy/degrees/bachelor-back.svg') },
        master: { front: asset('characters/boy/degrees/master-front.svg'), side: asset('characters/boy/degrees/master-side.svg'), back: asset('characters/boy/degrees/master-back.svg') },
        doctor: { front: asset('characters/boy/degrees/doctor-front.svg'), side: asset('characters/boy/degrees/doctor-side.svg'), back: asset('characters/boy/degrees/doctor-back.svg') },
      },
      turnaround: { front: asset('characters/boy/turnaround/front.svg'), side: asset('characters/boy/turnaround/side.svg'), back: asset('characters/boy/turnaround/back.svg') },
      stickers: {
        hi: asset('stickers/boy-hi.svg'),
        thinking: asset('stickers/boy-thinking.svg'),
        found: asset('stickers/boy-found.svg'),
        locked: asset('stickers/boy-locked.svg'),
        'need-help': asset('stickers/boy-need-help.svg'),
        ok: asset('stickers/boy-ok.svg'),
      },
    },
  },
}

const stateToAsset: Record<GeoMascotState, { expression?: GeoMascotExpression; action?: GeoMascotAction; sticker?: 'need-help' }> = {
  idle: { expression: 'happy' },
  thinking: { expression: 'thinking' },
  working: { action: 'execute-task' },
  celebrating: { action: 'complete-ok' },
  analyzing: { action: 'analyze-data' },
  discovering: { action: 'discover-insight' },
  complete: { action: 'complete-ok' },
  error: { sticker: 'need-help' },
}

function getPx(size: GeoMascotSize) {
  return typeof size === 'number' ? size : sizeMap[size]
}

function pickMascotSource(props: Required<Pick<GeoMascotProps, 'gender' | 'state' | 'view'>> & GeoMascotProps) {
  const pack = geoAgentCharacterAssets.character[props.gender]
  if (props.sticker) return pack.stickers[props.sticker]
  if (props.degree) return pack.degrees[props.degree][props.view]
  if (props.variant === 'turnaround') return pack.turnaround[props.view]
  if (props.action) return pack.actions[props.action]
  if (props.expression) return pack.expressions[props.expression]

  const fromState = stateToAsset[props.state]
  if (fromState.sticker) return pack.stickers[fromState.sticker]
  if (fromState.action) return pack.actions[fromState.action]
  if (fromState.expression) return pack.expressions[fromState.expression]
  return pack.base
}

export function GeoMascot({
  size = 'md',
  gender = 'girl',
  state = 'idle',
  variant = 'auto',
  expression,
  action,
  degree,
  view = 'front',
  sticker,
  className,
  style,
  alt,
  animated = true,
}: GeoMascotProps) {
  const px = getPx(size)
  const src = pickMascotSource({ gender, state, variant, expression, action, degree, view, sticker })

  return (
    <span
      className={cn('geo-agent-mascot', className)}
      style={{
        display: 'inline-flex',
        width: px,
        height: px,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.max(10, px * 0.2),
        filter: animated ? 'drop-shadow(0 10px 20px rgba(11, 26, 61, 0.18))' : undefined,
        animation: animated ? 'geoAgentBreathe 3.2s ease-in-out infinite' : undefined,
        ...style,
      }}
      data-geo-agent-gender={gender}
      data-geo-agent-state={state}
    >
      <style>{`@keyframes geoAgentBreathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.015)}}`}</style>
      <img
        src={src}
        width={px}
        height={px}
        alt={alt ?? `GeoWork ${gender === 'girl' ? '小 Gea' : '小 Geo'} agent`}
        draggable={false}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      />
    </span>
  )
}

export function GeoAgentLogo({ size = 34, className }: { size?: number; className?: string }) {
  return <img className={className} src={geoAgentCharacterAssets.logo.mark} width={size} height={size} alt="GeoWork" draggable={false} />
}

export function GeoAgentWordmark({ height = 46, className }: { height?: number; className?: string }) {
  return <img className={className} src={geoAgentCharacterAssets.logo.wordmark} height={height} alt="GeoWork 地理空间智能工作助手" draggable={false} />
}
