// GeoWork - GwTooltip Component
// Custom tooltip with positioning support

import React, { useState, useRef, useEffect, useCallback } from 'react'
import classNames from 'classnames'
import styles from './GwTooltip.module.scss'

export type GwTooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface GwTooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  content: React.ReactNode
  placement?: GwTooltipPlacement
  trigger?: 'hover' | 'click' | 'focus'
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  delay?: number
  disabled?: boolean
}

const defaultOffset: Record<GwTooltipPlacement, number> = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
}

export const GwTooltip: React.FC<GwTooltipProps> = ({
  content,
  placement = 'top',
  trigger = 'hover',
  visible: controlledVisible,
  onVisibleChange,
  delay = 150,
  disabled = false,
  children,
  className,
  style,
  ...rest
}) => {
  const [localVisible, setLocalVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [arrowPos, setArrowPos] = useState(50)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const isVisible = controlledVisible !== undefined ? controlledVisible : localVisible

  const show = useCallback(() => {
    if (delay > 0) {
      timerRef.current = setTimeout(() => {
        setLocalVisible(true)
        onVisibleChange?.(true)
      }, delay)
    } else {
      setLocalVisible(true)
      onVisibleChange?.(true)
    }
  }, [delay, onVisibleChange])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setLocalVisible(false)
    onVisibleChange?.(false)
  }, [onVisibleChange])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const offset = defaultOffset[placement]

    let top = 0
    let left = 0
    let arrow = 50

    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - offset
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        arrow = triggerRect.left + triggerRect.width / 2 - (tooltipRect.width / 2 - arrowPos)
        break
      case 'bottom':
        top = triggerRect.bottom + offset
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        arrow = triggerRect.left + triggerRect.width / 2 - (tooltipRect.width / 2 - arrowPos)
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.left - tooltipRect.width - offset
        arrow = triggerRect.top + triggerRect.height / 2 - (tooltipRect.height / 2 - arrowPos)
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.right + offset
        arrow = triggerRect.top + triggerRect.height / 2 - (tooltipRect.height / 2 - arrowPos)
        break
    }

    // Clamp to viewport
    top = Math.max(0, Math.min(top, window.innerHeight - tooltipRect.height))
    left = Math.max(0, Math.min(left, window.innerWidth - tooltipRect.width))

    setPosition({ top, left })
  }, [placement])

  useEffect(() => {
    if (isVisible) {
      updatePosition()
    }
  }, [isVisible, updatePosition])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const onMouseEnter = () => {
    if (trigger === 'hover' && !disabled) show()
  }

  const onMouseLeave = () => {
    if (trigger === 'hover' && !disabled) hide()
  }

  const onClick = () => {
    if (trigger === 'click' && !disabled) {
      isVisible ? hide() : show()
    }
  }

  const onFocus = () => {
    if (trigger === 'focus' && !disabled) show()
  }

  const onBlur = () => {
    if (trigger === 'focus' && !disabled) hide()
  }

  const arrowDirection = placement === 'top' ? 'down' : placement === 'bottom' ? 'up' : placement === 'left' ? 'right' : 'left'

  return (
    <span
      ref={triggerRef}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      {...rest}
    >
      {children}
      {isVisible && content && !disabled && (
        <div
          ref={tooltipRef}
          className={classNames(styles.tooltip, styles[placement])}
          style={{ top: position.top, left: position.left }}
        >
          <div className={styles.tooltipContent}>{content}</div>
          <div className={classNames(styles.arrow, styles[`arrow-${arrowDirection}`])} />
        </div>
      )}
    </span>
  )
}

export default GwTooltip
