import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAppearanceStore } from '../../shared/stores/appearanceStore'
import styles from './CapsuleTabs.module.css'

export interface CapsuleTabOption {
  value: string | number
  label?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface CapsuleTabsProps {
  options: CapsuleTabOption[]
  value?: string | number
  onChange?: (value: string | number) => void
  /** 铺满容器宽度（侧栏场景） */
  block?: boolean
  /** small = 侧栏紧凑版；middle/large = pub-toggle 原版尺寸 */
  size?: 'small' | 'middle' | 'large'
  className?: string
  style?: CSSProperties
  /** E2E 锚点前缀：生成 data-testid={`${testId}-${opt.value}`} */
  testId?: string
}

/**
 * CapsuleTabs — 胶囊选项卡
 * 视觉 1:1 复刻 BlogAstroPure pub-toggle（Gemini 官方最终版，
 * 源文件 src/pages/projects/index.astro L182-L295）。
 * 对齐设计系统 §10.1。
 */
export function CapsuleTabs({
  options,
  value,
  onChange,
  block,
  size = 'middle',
  className,
  style,
  testId,
}: CapsuleTabsProps) {
  const resolvedAppearance = useAppearanceStore((s) => s.resolvedAppearance)
  const isDark = resolvedAppearance === 'dark'

  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Map<string | number, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [skipTransition, setSkipTransition] = useState(false)

  /**
   * 滑块跟随选中项。用 getBoundingClientRect 相对容器实测，
   * 不用 offsetLeft —— 后者相对 offsetParent 的 border-box，
   * 与绝对定位滑块（相对 padding-box）参照系不一致，
   * block 弹性布局下会导致切换时滑块"从最左侧飞过来"。
   */
  const moveIndicator = useCallback(
    (target?: HTMLElement) => {
      const container = containerRef.current
      let el =
        target ?? (value === null || value === undefined ? undefined : btnRefs.current.get(value))

      // 后备：如果 ref 还没准备好，直接从 DOM 查找当前选中按钮
      if (!el && container && value !== null && value !== undefined) {
        el = container.querySelector(`[role="tab"][aria-selected="true"]`) as HTMLElement
      }

      if (!container || !el) return
      const cRect = container.getBoundingClientRect()
      const bRect = el.getBoundingClientRect()
      setIndicator({
        left: bRect.left - cRect.left - container.clientLeft,
        width: bRect.width,
      })
    },
    [value],
  )

  useLayoutEffect(() => {
    // 程序性更新时禁用过渡，避免指示器从错误位置飞入
    setSkipTransition(true)

    const container = containerRef.current
    const indicatorEl = container?.querySelector(`.${styles.indicator}`) as HTMLElement

    // 使用双重 rAF 确保 DOM 完全就绪后再移动指示器
    const rafId1 = requestAnimationFrame(() => {
      const rafId2 = requestAnimationFrame(() => {
        moveIndicator()
        if (indicatorEl) {
          indicatorEl.getBoundingClientRect() // 强制回流，确保 'none' 生效
        }
        setSkipTransition(false)
      })
      return () => cancelAnimationFrame(rafId2)
    })

    return () => cancelAnimationFrame(rafId1)
  }, [moveIndicator, options.length, value])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onResize = () => moveIndicator()
    const observer = new ResizeObserver(onResize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [moveIndicator])

  const vars = useMemo(
    () =>
      ({
        '--capsule-bg': isDark ? '#1f2128' : '#ffffff',
        '--capsule-border': isDark ? '#3a3d45' : '#e5e5e5',
        '--capsule-item-color': isDark ? '#9aa0a6' : '#1f1f1f',
        '--capsule-item-hover-bg': isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5',
      }) as CSSProperties,
    [isDark],
  )

  const rootClass = [
    styles.capsule,
    block ? styles.capsuleBlock : '',
    size === 'small' ? styles.capsuleSmall : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={containerRef} className={rootClass} role="tablist" style={{ ...vars, ...style }}>
      <span
        className={styles.indicator}
        aria-hidden="true"
        style={{
          left: indicator.left,
          width: indicator.width,
          transition: skipTransition
            ? 'none'
            : 'left 0.15s cubic-bezier(0.4, 0, 0.2, 1), width 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            data-testid={testId ? `${testId}-${opt.value}` : undefined}
            ref={(el) => {
              if (el) btnRefs.current.set(opt.value, el)
              else btnRefs.current.delete(opt.value)
            }}
            className={active ? `${styles.item} ${styles.itemSelected}` : styles.item}
            onClick={() => {
              // 不在这里直接移动指示器，避免与 value 变化后的 useLayoutEffect 重复触发动画
              onChange?.(opt.value)
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
