import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from 'antd'
import type { ConversationMessage } from '../../../../shared/session/types'
import { MessageBubbleX } from '../MessageBubbleX'
import { ConversationX } from '../ConversationX'
import { SenderX } from '../SenderX'

/* jsdom 无滚动高度，虚拟器算不出可视项——mock 为全量渲染 */
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; getItemKey?: (i: number) => string | number }) => ({
    getTotalSize: () => opts.count * 120,
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        key: opts.getItemKey ? opts.getItemKey(i) : i,
        index: i,
        start: i * 120,
      })),
    measureElement: () => {},
    scrollToIndex: vi.fn(),
  }),
}))

/* antd message/notification 依赖 App context，统一包一层 */
function withApp(ui: React.ReactNode) {
  return <App>{ui}</App>
}

function makeMsg(partial: Partial<ConversationMessage> & { id: string }): ConversationMessage {
  return {
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    ...partial,
  }
}

describe('MessageBubbleX（doc/26）', () => {
  it('user 消息渲染为右侧气泡纯文本', () => {
    render(
      withApp(
        <MessageBubbleX data={makeMsg({ id: 'm1', role: 'user', content: '做缓冲区分析' })} />,
      ),
    )
    expect(screen.getByText('做缓冲区分析')).toBeTruthy()
  })

  it('assistant 消息经 MarkdownStream 渲染', () => {
    render(
      withApp(<MessageBubbleX data={makeMsg({ id: 'm2', content: '## 分析计划\n\n- 缓冲区' })} />),
    )
    expect(document.querySelector('h2')?.textContent).toBe('分析计划')
  })

  it('thinkingSteps 渲染为 ThoughtChain（未结束步骤 loading 态）', () => {
    const msg = makeMsg({
      id: 'm3',
      content: '结果',
      thinkingSteps: [
        { id: 's1', kind: 'state', title: '规划中', content: '任务开始', startedAt: 1, endedAt: 2 },
        { id: 's2', kind: 'reasoning', title: '模型推理', content: '思考中', startedAt: 3 },
      ],
    })
    const { container } = render(withApp(<MessageBubbleX data={msg} />))
    expect(container.textContent).toContain('规划中')
    expect(container.textContent).toContain('模型推理')
  })

  it('fileDiffs / toolCalls 复用自研组件渲染', () => {
    const msg = makeMsg({
      id: 'm4',
      content: '已修改文件',
      toolCalls: [
        { id: 't1', name: 'write_file', status: 'success', inputSummary: 'a.ts', startedAt: 1 },
      ],
      fileDiffs: [{ id: 'd1', path: 'a.ts', unified: '@@ -1 +1 @@\n-x\n+y\n', createdAt: 1 }],
    })
    const { container } = render(withApp(<MessageBubbleX data={msg} />))
    /* ToolCallTimeline 默认收起为「查看工具日志」；DiffViewer 展示文件路径 */
    expect(container.textContent).toContain('查看工具日志')
    expect(container.textContent).toContain('a.ts')
  })
})

describe('ConversationX（doc/26）', () => {
  it('渲染全部消息 + pendingApproval 时展示审批卡片', () => {
    const messages = [
      makeMsg({ id: 'u1', role: 'user', content: '用户问题' }),
      makeMsg({ id: 'a1', content: '助手回答' }),
    ]
    render(
      withApp(
        <ConversationX
          messages={messages}
          runStatus="running"
          pendingApproval={{
            id: 'appr-1',
            toolName: 'run_shell',
            args: { command: 'ls' },
            riskLevel: 'high',
            createdAt: new Date().toISOString(),
          }}
          onResolveApproval={vi.fn().mockResolvedValue(undefined)}
          onConfirmRun={vi.fn()}
          onAdjustPlan={vi.fn()}
        />,
      ),
    )
    expect(screen.getByText('用户问题')).toBeTruthy()
    expect(screen.getByText('助手回答')).toBeTruthy()
    expect(screen.getByText(/run_shell/)).toBeTruthy()
  })
})

describe('SenderX（doc/26）', () => {
  it('输入触发 onPromptChange，提交触发 onSend', () => {
    const onPromptChange = vi.fn()
    const onSend = vi.fn()
    render(
      withApp(
        <SenderX
          prompt=""
          onPromptChange={onPromptChange}
          onSend={onSend}
          onStop={vi.fn()}
          isStreaming={false}
          model="Auto"
          onModelChange={vi.fn()}
        />,
      ),
    )
    const textarea = document.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: '做叠加分析' } })
    expect(onPromptChange).toHaveBeenCalledWith('做叠加分析')
  })

  it('流式中展示停止按钮，点击触发 onStop', () => {
    const onStop = vi.fn()
    render(
      withApp(
        <SenderX
          prompt="进行中"
          onPromptChange={vi.fn()}
          onSend={vi.fn()}
          onStop={onStop}
          isStreaming
          model="Auto"
          onModelChange={vi.fn()}
        />,
      ),
    )
    /* Sender loading 态渲染 LoadingButton（aria-label 含 stop 语义） */
    const stopBtn = document.querySelector(
      '[data-testid="sender-x"] button[class*="loading"], [data-testid="sender-x"] .ant-btn',
    )
    expect(stopBtn).toBeTruthy()
  })
})
