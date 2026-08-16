/**
 * MarkdownStream — AI 回复的流式 Markdown 渲染（doc/23 §A2）
 *
 * 替换手写正则的 MarkdownLite：
 * - react-markdown + remark-gfm：表格/列表/标题/链接/引用全支持
 * - 代码块：语言标签 + 复制按钮 + Shiki 高亮（动态 import，不进主包）
 * - 流式容错：未闭合 ``` fence 按代码块渲染——流式的自然形态；
 *   高亮 200ms debounce，流式输出期间不反复跑 Shiki
 * - 配色经 CSS 变量注入 antd token，跟随三套主题
 */

import { isValidElement, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { App, Button, Typography, theme } from 'antd'
import { Check, Copy } from 'lucide-react'
import { useAppearanceStore } from '../../../shared/stores/appearanceStore'
import styles from './MarkdownStream.module.css'

const { Text } = Typography

/* ── Shiki 懒加载单例（细粒度入口：core + 指定语言 + JS 正则引擎，
      避免全量入口把几十种语言各打进 ~800KB chunk） ── */

type ShikiHighlighter = {
  codeToHtml: (code: string, opts: { lang: string; theme: string }) => string
}

let highlighterPromise: Promise<ShikiHighlighter | null> | null = null

function getHighlighter(): Promise<ShikiHighlighter | null> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/sql.mjs'),
      import('shiki/langs/yaml.mjs'),
      import('shiki/langs/markdown.mjs'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
      .then(
        ([
          core,
          engine,
          python,
          json,
          javascript,
          typescript,
          bash,
          sql,
          yaml,
          markdown,
          githubLight,
          githubDark,
        ]) =>
          core.createHighlighterCore({
            themes: [githubLight.default, githubDark.default],
            langs: [
              python.default,
              json.default,
              javascript.default,
              typescript.default,
              bash.default,
              sql.default,
              yaml.default,
              markdown.default,
            ],
            engine: engine.createJavaScriptRegexEngine(),
          }) as unknown as Promise<ShikiHighlighter>,
      )
      .catch(() => null /* 高亮失败降级纯文本 */)
  }
  return highlighterPromise
}

/* ── 代码块 ── */

interface CodeBlockProps {
  code: string
  lang?: string
  dark: boolean
}

const KNOWN_LANGS = new Set([
  'python',
  'json',
  'javascript',
  'typescript',
  'bash',
  'sql',
  'yaml',
  'markdown',
])

function CodeBlockInner({ code, lang, dark }: CodeBlockProps) {
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!lang || !KNOWN_LANGS.has(lang)) return
    /* debounce：流式期间 code 高频变化，只在稳定 200ms 后跑一次 Shiki */
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void getHighlighter().then((h) => {
        if (!h || !aliveRef.current) return
        try {
          setHighlighted(h.codeToHtml(code, { lang, theme: dark ? 'github-dark' : 'github-light' }))
        } catch {
          /* 语言未注册等：保持纯文本 */
        }
      })
    }, 200)
  }, [code, lang, dark])

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true)
        message.success('已复制代码')
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => message.warning('复制失败'),
    )
  }

  return (
    <div
      className={styles.codeBlock}
      style={{
        borderColor: token.colorBorderSecondary,
        background: dark ? '#0d1117' : token.colorFillQuaternary,
      }}
    >
      <div
        className={styles.codeHeader}
        style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
          {lang ?? 'text'}
        </Text>
        <Button
          type="text"
          size="small"
          className={styles.copyBtn}
          icon={copied ? <Check size={13} /> : <Copy size={13} />}
          onClick={handleCopy}
        />
      </div>
      {highlighted ? (
        <div
          className={styles.codeHighlighted}
          /* Shiki 输出的 HTML 已按语言转义 */
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className={styles.codeRaw}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

const CodeBlock = memo(CodeBlockInner)

/* ── pre 拦截：从 react-markdown 的 AST 提取代码与语言 ── */

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

function PreRenderer({ children }: { children?: ReactNode }) {
  const resolvedAppearance = useAppearanceStore((s) => s.resolvedAppearance)
  const codeEl = Array.isArray(children) ? children[0] : children
  const className = isValidElement(codeEl)
    ? String((codeEl.props as { className?: string }).className ?? '')
    : ''
  const lang = /language-([\w-]+)/.exec(className)?.[1]
  const code = extractText(codeEl).replace(/\n$/, '')
  return <CodeBlock code={code} lang={lang} dark={resolvedAppearance === 'dark'} />
}

/* ── 主组件 ── */

export interface MarkdownStreamProps {
  content: string
}

export const MarkdownStream = memo(function MarkdownStream({ content }: MarkdownStreamProps) {
  const { token } = theme.useToken()

  return (
    <div
      className={styles.md}
      style={
        {
          '--md-text': token.colorText,
          '--md-text-secondary': token.colorTextSecondary,
          '--md-primary': token.colorPrimary,
          '--md-border': token.colorBorderSecondary,
          '--md-bg-hover': token.colorFillTertiary,
          '--md-code-bg': token.colorFillSecondary,
          '--md-primary-bg': token.colorPrimaryBg,
        } as React.CSSProperties
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: PreRenderer,
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
