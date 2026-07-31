import type { ConfigProviderProps } from 'antd'
import { createStyles } from 'antd-style'

const useEditorialStyles = createStyles(({ css }) => ({
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
      border-color: #9b8976;
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

export function useEditorialTheme(): ConfigProviderProps {
  const { styles } = useEditorialStyles()

  return {
    theme: {
      token: {
        colorPrimary: '#9B8976',
        colorInfo: '#9B8976',
        colorBgLayout: '#f5f5f4',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: '#e7e5e4',
        colorBorderSecondary: '#f0efed',
        colorText: '#1c1917',
        colorTextSecondary: '#44403c',
        colorTextTertiary: '#78716c',
        colorTextQuaternary: '#a8a29e',
        colorSuccess: '#16a34a',
        colorLink: '#2563eb',

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
        Tag: {
          borderRadiusSM: 0,
        },
        Card: {
          borderRadiusLG: 0,
        },
        Input: {
          borderRadius: 2,
          borderRadiusLG: 2,
        },
        Menu: {
          itemBorderRadius: 6,
          itemSelectedBg: '#e7e5e4',
          itemSelectedColor: '#1c1917',
          itemHoverBg: '#f0efed',
        },
        Table: {
          headerBg: '#fafaf9',
          headerColor: '#78716c',
          borderColor: '#f5f5f4',
        },
        Dropdown: {
          borderRadiusLG: 10,
        },
      },
    },
    button: { classNames: { root: styles.button } },
    tag: { classNames: { root: styles.tag } },
    card: { classNames: { root: styles.card } },
    modal: { classNames: { container: styles.modal } },
  }
}
