import { useCallback, type ReactNode } from 'react'
import { App, Button, Typography, theme } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import styles from './MarkdownLite.module.css'

const { Text } = Typography

interface MarkdownLiteProps {
  content: string
}

/* ── 行内解析：`code` + **bold** ── */
function parseInline(text: string, token: { colorPrimary: string }): ReactNode[] {
  const nodes: ReactNode[] = []
  /* regex: `code` | **bold** */
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    /* 前面的普通文本 */
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      /* inline code */
      const code = match[1].slice(1, -1)
      nodes.push(
        <code
          key={match.index}
          className={styles.inlineCode}
          style={{
            background: token.colorPrimary + '14',
            color: token.colorPrimary,
          }}
        >
          {code}
        </code>,
      )
    } else if (match[2]) {
      /* bold */
      const boldText = match[2].slice(2, -2)
      nodes.push(<strong key={match.index}>{boldText}</strong>)
    }

    lastIndex = match.index + match[0].length
  }

  /* 尾部普通文本 */
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

/* ── 代码块组件 ── */
function CodeBlock({
  language,
  code,
}: {
  language: string
  code: string
}) {
  const { token } = theme.useToken()
  const { message } = App.useApp()

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(
      () => message.success('代码已复制'),
      () => message.warning('复制失败，请手动选择文本复制'),
    )
  }, [code, message])

  return (
    <div
      className={styles.codeBlock}
      style={{
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div
        className={styles.codeBlockHeader}
        style={{
          background: token.colorFillTertiary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          {language || 'code'}
        </Text>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
        >
          复制
        </Button>
      </div>
      <pre
        className={styles.codeBlockBody}
        style={{ color: token.colorText }}
      >
        {code}
      </pre>
    </div>
  )
}

/* ── 主组件 ── */
export function MarkdownLite({ content }: MarkdownLiteProps) {
  const { token } = theme.useToken()

  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    /* ── Fenced code block ── */
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      /* 跳过闭合 ``` */
      if (i < lines.length) i++
      blocks.push(
        <CodeBlock key={blocks.length} language={lang} code={codeLines.join('\n')} />,
      )
      continue
    }

    /* ── Blockquote ── */
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <div
          key={blocks.length}
          className={styles.blockquote}
          style={{
            borderLeftColor: token.colorPrimary,
            background: token.colorFillQuaternary,
          }}
        >
          <Text type="secondary">
            {parseInline(quoteLines.join(' '), token)}
          </Text>
        </div>,
      )
      continue
    }

    /* ── Unordered list ── */
    if (/^[\s]*[-*]\s/.test(line)) {
      const listItems: ReactNode[] = []
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^[\s]*[-*]\s/, '')
        listItems.push(
          <li key={listItems.length}>
            {parseInline(itemText, token)}
          </li>,
        )
        i++
      }
      blocks.push(
        <ul key={blocks.length} className={styles.list}>
          {listItems}
        </ul>,
      )
      continue
    }

    /* ── Ordered list ── */
    if (/^\d+\.\s/.test(line)) {
      const listItems: ReactNode[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s/, '')
        listItems.push(
          <li key={listItems.length}>
            {parseInline(itemText, token)}
          </li>,
        )
        i++
      }
      blocks.push(
        <ol key={blocks.length} className={styles.list}>
          {listItems}
        </ol>,
      )
      continue
    }

    /* ── Empty line → skip ── */
    if (line.trim() === '') {
      i++
      continue
    }

    /* ── Paragraph: collect consecutive non-special lines ── */
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[\s]*[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={blocks.length} className={styles.paragraph}>
          {parseInline(paraLines.join('\n'), token)}
        </p>,
      )
    }
  }

  return <div>{blocks}</div>
}
