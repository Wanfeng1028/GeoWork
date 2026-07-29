import { useMemo } from 'react'
import { theme } from 'antd'
import type { ConfigProviderProps } from 'antd'
import { createStyles } from 'antd-style'

const GLASS_BG = 'rgba(255, 255, 255, 0.55)'
const GLASS_BORDER = 'rgba(255, 255, 255, 0.35)'
const GLASS_SHADOW =
  'inset 0 1px 2px rgba(255, 255, 255, 0.5), inset 0 -1px 2px rgba(0, 0, 0, 0.05)'
const BLUR = 'blur(12px)'

const useStyles = createStyles(() => ({
  /* ── Card: 半透明 + 模糊 ── */
  cardRoot: {
    backgroundColor: 'transparent',
    borderColor: GLASS_BORDER,
  },
  cardBody: {
    backgroundColor: GLASS_BG,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    borderRadius: 12,
    boxShadow: GLASS_SHADOW,
    border: `1px solid ${GLASS_BORDER}`,
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 12,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)',
      pointerEvents: 'none',
    },
  },

  /* ── Modal: 半透明 + 模糊 ── */
  modalContainer: {
    backgroundColor: GLASS_BG,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    borderColor: GLASS_BORDER,
    boxShadow: `${GLASS_SHADOW}, 0 8px 32px rgba(0, 0, 0, 0.08)`,
  },

  /* ── Button: 默认按钮透明化 ── */
  buttonRoot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: GLASS_BORDER,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
  },

  /* ── Dropdown ── */
  dropdownRoot: {
    backgroundColor: GLASS_BG,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    borderColor: GLASS_BORDER,
    boxShadow: GLASS_SHADOW,
  },

  /* ── Select ── */
  selectRoot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: GLASS_BORDER,
  },
  selectPopupRoot: {
    backgroundColor: GLASS_BG,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    borderColor: GLASS_BORDER,
    boxShadow: GLASS_SHADOW,
  },

  /* ── Input ── */
  inputRoot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: GLASS_BORDER,
  },

  /* ── DatePicker ── */
  datePickerRoot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: GLASS_BORDER,
  },

  /* ── Popover ── */
  popoverRoot: {
    backgroundColor: GLASS_BG,
    backdropFilter: BLUR,
    WebkitBackdropFilter: BLUR,
    borderColor: GLASS_BORDER,
  },

  /* ── Switch: 玻璃边界感 ── */
  switchRoot: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
    border: `1px solid ${GLASS_BORDER}`,
  },

  /* ── Progress ── */
  progressTrack: {
    borderRadius: 12,
  },
  progressRail: {
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
}))

export function useGlassTheme(): ConfigProviderProps {
  const { styles } = useStyles()

  return useMemo<ConfigProviderProps>(
    () => ({
      theme: {
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 12,
          borderRadiusLG: 12,
          borderRadiusSM: 12,
          borderRadiusXS: 12,
          motionDurationSlow: '0.2s',
          motionDurationMid: '0.1s',
          motionDurationFast: '0.05s',
          colorBgLayout: '#E8EEF4',
          colorBgContainer: 'rgba(255, 255, 255, 0.6)',
          colorBgElevated: 'rgba(255, 255, 255, 0.7)',
          colorBorder: 'rgba(255, 255, 255, 0.4)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.3)',
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(255, 255, 255, 0.5)',
          },
          Modal: {
            colorBgElevated: 'rgba(255, 255, 255, 0.75)',
          },
          Button: {
            defaultBg: 'rgba(255, 255, 255, 0.3)',
            defaultBorderColor: 'rgba(255, 255, 255, 0.4)',
          },
          Input: {
            colorBgContainer: 'rgba(255, 255, 255, 0.3)',
            colorBorder: 'rgba(255, 255, 255, 0.4)',
          },
          Select: {
            colorBgContainer: 'rgba(255, 255, 255, 0.3)',
            colorBorder: 'rgba(255, 255, 255, 0.4)',
            optionSelectedBg: 'rgba(255, 255, 255, 0.2)',
          },
          Segmented: {
            itemSelectedBg: 'rgba(255, 255, 255, 0.5)',
            itemHoverBg: 'rgba(255, 255, 255, 0.3)',
            trackBg: 'rgba(255, 255, 255, 0.2)',
          },
          Radio: {
            colorBorder: 'rgba(255, 255, 255, 0.4)',
          },
          Switch: {
            colorBgContainer: 'rgba(0, 0, 0, 0.06)',
          },
        },
      },
      wave: { showEffect: () => {} },
      card: {
        classNames: {
          root: styles.cardRoot,
          body: styles.cardBody,
        },
      },
      modal: {
        classNames: {
          container: styles.modalContainer,
        },
      },
      button: {
        classNames: {
          root: styles.buttonRoot,
        },
      },
      dropdown: {
        classNames: {
          root: styles.dropdownRoot,
        },
      },
      select: {
        classNames: {
          root: styles.selectRoot,
          popup: {
            root: styles.selectPopupRoot,
          },
        },
      },
      input: {
        classNames: {
          root: styles.inputRoot,
        },
      },
      switch: {
        classNames: {
          root: styles.switchRoot,
        },
      },
      progress: {
        classNames: {
          track: styles.progressTrack,
          rail: styles.progressRail,
        },
      },
    }),
    [styles],
  )
}
