import { theme as antTheme } from 'antd'
import type { ConfigProviderProps } from 'antd'
import { createStyles } from 'antd-style'

const useEditorialDarkStyles = createStyles(({ css }) => ({
  button: css`
    border-radius: 0 !important;
    font-weight: 500;
    letter-spacing: 0.02em;
  `,
  tag: css`
    border-radius: 0 !important;
  `,
  card: css`
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    transition: border-color 0.25s;
    &:hover {
      border-color: #b8a898;
    }
  `,
  input: css`
    border-radius: 2px;
  `,
  modal: css`
    .ant-modal-content {
      border-radius: 0;
    }
  `,
}))

export function useEditorialDarkTheme(): ConfigProviderProps {
  const { styles } = useEditorialDarkStyles()

  return {
    theme: {
      algorithm: antTheme.darkAlgorithm,
      token: {
        colorPrimary: '#b8a898',
        colorInfo: '#b8a898',
        colorBgLayout: '#0c0a09',
        colorBgContainer: '#1c1917',
        colorBgElevated: '#292524',
        colorBorder: '#292524',
        colorBorderSecondary: '#44403c',
        colorText: '#fafaf9',
        colorTextSecondary: '#d6d3d1',
        colorTextTertiary: '#a8a29e',
        colorTextQuaternary: '#78716c',
        colorSuccess: '#4ade80',
        colorLink: '#93c5fd',

        borderRadius: 0,
        borderRadiusLG: 0,
        borderRadiusSM: 0,
        borderRadiusXS: 0,
        borderRadiusOuter: 0,

        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: 13,

        lineWidth: 1,
        controlHeight: 34,
      },
      components: {
        Button: {
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          fontWeight: 500,
        },
        Tag: { borderRadiusSM: 0 },
        Card: { borderRadiusLG: 0 },
        Input: { borderRadius: 2, borderRadiusLG: 2 },
        Menu: {
          itemBorderRadius: 6,
          itemSelectedBg: '#292524',
          itemSelectedColor: '#fafaf9',
          itemHoverBg: '#292524',
        },
        Table: {
          headerBg: '#292524',
          headerColor: '#a8a29e',
          borderColor: '#292524',
        },
        Dropdown: { borderRadiusLG: 10 },
      },
    },
    button: { classNames: { root: styles.button } },
    tag: { classNames: { root: styles.tag } },
    card: { classNames: { root: styles.card } },
    modal: { classNames: { container: styles.modal } },
  }
}
