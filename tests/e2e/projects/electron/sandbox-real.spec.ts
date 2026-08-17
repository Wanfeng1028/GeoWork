/**
 * 沙箱真实执行端到端（P7-1）— 验证 run_command 经 IPC 桥在真实 workspace 落盘。
 *
 * 这是"生产装配等价"回归：纯 Chromium 渲染层无法触达 Go core 沙箱，
 * 本 spec 在真实 Electron 壳里断言：
 *   1. runtime.runCommand() 经 IPC → core /api/sandbox/run-command 启动进程
 *   2. 进程到达终态（completed），stdout 被捕获
 *   3. 命令在真实 workspace 目录落盘（从测试侧 fs 验证文件存在）
 *
 * 跨平台：core 按 GOOS 选 shell（bash / cmd / pwsh），`echo x > file`
 * 在三种 shell 下都能创建文件，故用文件存在性做落盘断言。
 */
import { test, expect } from '../../fixtures/electron.fixture'
import fs from 'node:fs'
import { resolve } from 'node:path'

test.describe('Sandbox Real Execution @integration', () => {
  test('runCommand 启动进程并捕获 stdout', async ({ window, processes }) => {
    const taskId = `e2e-sandbox-${Date.now()}`

    const proc = await window.evaluate(
      ({ taskId, workspace }) =>
        (window as any).geowork.runtime.runCommand({
          taskId,
          workspace,
          command: 'echo geowork-sandbox-alive',
        }),
      { taskId, workspace: processes.workspace },
    )

    expect(proc, 'runCommand 应返回进程对象').toBeTruthy()
    expect(proc.id, '进程应有 id').toBeTruthy()
    expect(proc.taskId, '进程 taskId 应回显').toBe(taskId)

    // run-command 异步：响应快照可能仍 running，轮询 listProcesses 到终态
    const terminal = await window.evaluate(async (taskId: string) => {
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const list = await (window as any).geowork.runtime.listProcesses(taskId)
        const p = (Array.isArray(list) ? list : []).find((x: any) => x.taskId === taskId)
        if (p && p.status !== 'running') return p
        await new Promise((r) => setTimeout(r, 200))
      }
      return null
    }, taskId)

    expect(terminal, '进程应在 30s 内到达终态').toBeTruthy()
    expect(terminal.status, 'echo 命令应 completed').toBe('completed')
    expect(terminal.exitCode, '退出码应为 0').toBe(0)
    expect(terminal.stdout, 'stdout 应捕获 echo 输出').toContain('geowork-sandbox-alive')
  })

  test('runCommand 在真实 workspace 落盘', async ({ window, processes }) => {
    const taskId = `e2e-sandbox-disk-${Date.now()}`
    const marker = 'geowork_marker.txt'

    await window.evaluate(
      ({ taskId, workspace, marker }) =>
        (window as any).geowork.runtime.runCommand({
          taskId,
          workspace,
          command: `echo geowork-disk-write > ${marker}`,
        }),
      { taskId, workspace: processes.workspace, marker },
    )

    // 轮询到终态
    const terminal = await window.evaluate(async (taskId: string) => {
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const list = await (window as any).geowork.runtime.listProcesses(taskId)
        const p = (Array.isArray(list) ? list : []).find((x: any) => x.taskId === taskId)
        if (p && p.status !== 'running') return p
        await new Promise((r) => setTimeout(r, 200))
      }
      return null
    }, taskId)

    expect(terminal, '进程应到达终态').toBeTruthy()
    expect(terminal.status, '写文件命令应 completed').toBe('completed')

    // 从测试侧验证文件真实落盘（沙箱 cwd = workspace）
    const filePath = resolve(processes.workspace, marker)
    await expect
      .poll(() => fs.existsSync(filePath), { timeout: 5_000, message: `沙箱应在 workspace 落盘 ${marker}` })
      .toBe(true)

    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content, '落盘内容应包含写入的字符串').toContain('geowork-disk-write')
  })

  test('被封锁命令（sudo）被沙箱策略拒绝', async ({ window, processes }) => {
    const taskId = `e2e-sandbox-blocked-${Date.now()}`

    // sudo 在 BlockedCmds 中 → RunCommand 返回错误，writeResult 走 400 分支，
    // runtimeIpc 把非 JSON 错误体包成 { raw } 或抛错。断言不产生 completed 进程。
    await window.evaluate(
      ({ taskId, workspace }) =>
        (window as any).geowork.runtime
          .runCommand({ taskId, workspace, command: 'sudo rm -rf /' })
          .catch(() => null),
      { taskId, workspace: processes.workspace },
    )

    // 短暂等待后确认没有该 taskId 的 completed 进程
    await new Promise((r) => setTimeout(r, 500))
    const list = await window.evaluate(
      (taskId: string) => (window as any).geowork.runtime.listProcesses(taskId),
      taskId,
    )
    const procs = Array.isArray(list) ? list : []
    const completed = procs.filter((p: any) => p.status === 'completed')
    expect(completed.length, '被封锁命令不应产生 completed 进程').toBe(0)
  })
})
