import { useMemo } from 'react'
import { theme } from 'antd'
import type { ConfigProviderProps } from 'antd'
import { createStyles } from 'antd-style'

const BORDER = '#2C2C2C'

const useStyles = createStyles(() => ({
  /* ── Card: 硬阴影 + 粉色调背景 ── */
  cardRoot: {
    border: `3px solid ${BORDER}`,
    borderRadius: 16,
  },
  cardBody: {
    backgroundColor: '#FFF0F6',
    boxShadow: '4px 4px 0 #2C2C2C',
    borderRadius: 12,
  },

  /* ── Modal: 粗描边 ── */
  modalContainer: {
    border: `3px solid ${BORDER}`,
    borderRadius: 16,
    boxShadow: '6px 6px 0 #2C2C2C',
  },
  modalHeader: {
    borderBottom: `3px solid ${BORDER}`,
    fontWeight: 600,
  },
  modalFooter: {
    borderTop: `3px solid ${BORDER}`,
  },

  /* ── Button: 去阴影、加粗字重、粗描边 ── */
  buttonRoot: {
    fontWeight: 600,
    borderWidth: 3,
    boxShadow: 'none',
    borderRadius: 12,
  },

  /* ── Dropdown: 粗描边 ── */
  dropdownRoot: {
    border: `3px solid ${BORDER}`,
    borderRadius: 12,
    boxShadow: '4px 4px 0 #2C2C2C',
  },

  /* ── Select ── */
  selectRoot: {
    borderWidth: 3,
    borderColor: BORDER,
    borderRadius: 12,
  },
  selectPopupRoot: {
    border: `3px solid ${BORDER}`,
    borderRadius: 12,
    boxShadow: '4px 4px 0 #2C2C2C',
  },

  /* ── Input: 粗描边 ── */
  inputRoot: {
    borderWidth: 3,
    borderColor: BORDER,
    borderRadius: 12,
  },

  /* ── Switch ── */
  switchRoot: {
    border: `2px solid ${BORDER}`,
    boxShadow: '2px 2px 0 #2C2C2C',
  },

  /* ── Progress ── */
  progressTrack: {
    borderRadius: 8,
  },
  progressRail: {
    borderRadius: 8,
  },

  /* ── Tooltip ── */
  tooltipRoot: {
    border: `2px solid ${BORDER}`,
    borderRadius: 8,
  },
}))

export function useIllustrationTheme(): ConfigProviderProps {
  const { styles } = useStyles()

  return useMemo<ConfigProviderProps>(
    () => ({
      theme: {
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#52C41A',
          colorSuccess: '#51CF66',
          colorWarning: '#FFD93D',
          colorError: '#FA5252',
          colorInfo: '#4DABF7',
          colorText: '#2C2C2C',
          colorBorder: '#2C2C2C',
          colorBorderSecondary: '#2C2C2C',
          colorBgBase: '#FFF9F0',
          colorBgLayout: '#FFF9F0',
          colorBgContainer: '#FFFFFF',
          lineWidth: 3,
          lineWidthBold: 3,
          borderRadius: 12,
          borderRadiusLG: 16,
          borderRadiusSM: 8,
          controlHeight: 40,
          controlHeightSM: 34,
          controlHeightLG: 48,
          fontSize: 15,
          fontWeightStrong: 600,
        },
        components: {
          Button: {
            primaryShadow: 'none',
            dangerShadow: 'none',
            defaultShadow: 'none',
            fontWeight: 600,
          },
          Card: {
            boxShadow: '4px 4px 0 #2C2C2C',
            colorBgContainer: '#FFF0F6',
          },
          Modal: {
            boxShadow: 'none',
          },
          Tooltip: {
            colorBorder: '#2C2C2C',
            colorBgSpotlight: 'rgba(100, 100, 100, 0.95)',
            borderRadius: 8,
          },
          Select: {
            optionSelectedBg: 'transparent',
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
          header: styles.modalHeader,
          footer: styles.modalFooter,
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
