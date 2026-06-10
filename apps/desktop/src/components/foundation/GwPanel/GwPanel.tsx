// GeoWork - GwPanel Component
// Panel container for docks, sidebars, and modal panels

import React from 'react'
import classNames from 'classnames'
import styles from './GwPanel.module.scss'

export type GwPanelVariant = 'sidebar' | 'dock' | 'modal' | 'floating'
export type GwPanelPosition = 'left' | 'right' | 'top' | 'bottom'

export interface GwPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GwPanelVariant
  position?: GwPanelPosition
  title?: React.ReactNode
  extra?: React.ReactNode
  closable?: boolean
  onClose?: () => void
  headerStyle?: React.CSSProperties
  bodyStyle?: React.CSSProperties
  resizeHandle?: boolean
  onResize?: (width: number) => void
}

const variantClasses: Record<GwPanelVariant, string> = {
  sidebar: styles.sidebar,
  dock: styles.dock,
  modal: styles.modal,
  floating: styles.floating,
}

const positionClasses: Partial<Record<GwPanelPosition, string>> = {
  left: styles.left,
  right: styles.right,
  top: styles.top,
  bottom: styles.bottom,
}

export const GwPanel: React.FC<GwPanelProps> = ({
  variant = 'dock',
  position = 'right',
  title,
  extra,
  closable = false,
  onClose,
  children,
  className,
  style,
  headerStyle,
  bodyStyle,
  resizeHandle,
  ...rest
}) => {
  const cls = classNames(
    styles.panel,
    variantClasses[variant],
    positionClasses[position],
    resizeHandle ? styles.resizable : undefined,
    className
  )

  return (
    <div className={cls} style={style} {...rest}>
      {(title || closable || extra) && (
        <div className={styles.header} style={headerStyle}>
          {title && <span className={styles.title}>{title}</span>}
          <div className={styles.actions}>
            {extra}
            {closable && (
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="关闭"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
      <div className={styles.body} style={bodyStyle}>
        {children}
      </div>
      {resizeHandle && (
        <div className={styles.resizeHandle} />
      )}
    </div>
  )
}

export default GwPanel
