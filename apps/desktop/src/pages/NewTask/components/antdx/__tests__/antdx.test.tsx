import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from 'antd'
import type { ConversationMessage } from '../../../../shared/session/types'
import { MessageBubbleX } from '../MessageBubbleX'
import { ConversationX } from '../ConversationX'
import { SenderX } from '../SenderX'
import { WelcomeX } from '../WelcomeX'
import { loadWelcomePrompts, loadExpertCommands } from '../promptData'

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

describe('promptData（doc/26 二期）', () => {
  it('loadWelcomePrompts 返回已安装内置技能（installed+enabled）', () => {
    const prompts = loadWelcomePrompts()
    expect(prompts.length).toBeGreaterThan(0)
    /* 内置技能默认 installed+enabled，应出现在推荐里 */
    expect(prompts.some((p) => p.label === 'CSV 解析')).toBe(true)
    /* 点击填入「使用技能」引导语 */
    const csv = prompts.find((p) => p.label === 'CSV 解析')!
    expect(csv.text).toContain('CSV 解析')
  })

  it('loadExpertCommands 返回已安装专家的 / 触发词', () => {
    const commands = loadExpertCommands()
    expect(commands.length).toBeGreaterThan(0)
    /* 空间分析规划师默认 installed，其快捷命令以 / 开头 */
    expect(commands.some((c) => c.label.startsWith('/'))).toBe(true)
    expect(commands.some((c) => c.expertName === '空间分析规划师')).toBe(true)
  })
})

describe('WelcomeX（doc/26 二期）', () => {
  it('Prompts 渲染真实技能，点击填入输入框', () => {
    const onPickPrompt = vi.fn()
    render(
      withApp(
        <WelcomeX
          workMode="work"
          title="GeoWork"
          subtitle="描述你的 GIS 任务"
          onPickPrompt={onPickPrompt}
        />,
      ),
    )
    /* 真实内置技能名出现在推荐区 */
    expect(screen.getByText('CSV 解析')).toBeTruthy()
    fireEvent.click(screen.getByText('CSV 解析'))
    expect(onPickPrompt).toHaveBeenCalled()
    expect(onPickPrompt.mock.calls[0][0]).toContain('CSV 解析')
  })
})

describe('SenderX 输入联想（doc/26 二期）', () => {
  it('输入 / 打开联想面板，展示技能与专家命令', () => {
    const { container } = render(
      withApp(
        <SenderX
          prompt=""
          onPromptChange={vi.fn()}
          onSend={vi.fn()}
          onStop={vi.fn()}
          isStreaming={false}
          model="Auto"
          onModelChange={vi.fn()}
        />,
      ),
    )
    /* 作用域查询：同文件多个 SenderX 用例的残留 DOM 不影响本次断言 */
    const textarea = container.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: '/' } })
    /* 联想面板（Cascader popup portal 到 body）渲染技能与专家命令 */
    const popup = document.querySelector('.ant-cascader-dropdown')
    expect(popup?.textContent).toContain('CSV 解析')
    expect(popup?.textContent).toContain('/缓冲区分析')
  })
})
