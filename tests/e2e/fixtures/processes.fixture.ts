/**
 * 三进程 testbed fixture（P7-1）— worker 级进程编排。
 *
 * 在 Electron 启动前预启 server(8767) / core(8765) / worker(8766)，
 * 全部以 GEOWORK_INSECURE_NO_AUTH=1 运行（token 铸造/注入路径由单测覆盖，
 * 本 fixture 聚焦 Electron↔core↔worker 集成链本身）。
 *
 * Electron 主进程的 startRuntime() 检测到 8765/8767 端口已占用会跳过自启
 * （runtime.ts isPortInUse 分支），直接连接预启进程——这是生产代码显式
 * 支持的"外部进程"模式。
 *
 * 进程来源（按优先级）：
 *   1. 预构建二进制：GEOWORK_SERVER_BIN / GEOWORK_CORE_BIN（CI 预构建，启动快）
 *   2. go run 回退（本地开发，首次需编译）
 * worker 固定走 python -m uvicorn（GEOWORK_PYTHON 可覆盖解释器路径）。
 *
 * 健康门：每个进程 ready 后才放行测试（轮询 /health 或对应探活端点），
 * 参考 scripts/worker_smoke_contract.py 的轮询模式。
 *
 * 用法：
 *   import { test } from '../fixtures/processes.fixture'
 *   test('...', async ({ processes }) => { ... })
 */
import { test as base } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')

export const SERVER_PORT = 8767
export const CORE_PORT = 8765
export const WORKER_PORT = 8766
const HEALTH_TIMEOUT_MS = Number(process.env.GEOWORK_TESTBED_HEALTH_TIMEOUT_MS || 180_000)

export interface ProcessBundle {
  server: ChildProcess
  core: ChildProcess
  worker: ChildProcess
  /** 临时 workspace 目录（sandbox spec 用） */
  workspace: string
  /** 临时 SQLite DB 路径 */
  dbPath: string
}

/** 端口是否已被占用（占用说明有 dev 进程在跑，testbed 必须 fail fast 避免打错目标）。 */
function portInUse(port: number): Promise<boolean> {
  return new Promise((res) => {
    const s = new net.Socket()
    s.setTimeout(1000)
    s.once('connect', () => { s.destroy(); res(true) })
    s.once('timeout', () => { s.destroy(); res(false) })
    s.once('error', () => res(false))
    s.connect(port, '127.0.0.1')
  })
}

/** 轮询 HTTP 健康端点直到 200 或超时。 */
async function waitForHealth(url: string, label: string): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  let lastErr = ''
  while (Date.now() < deadline) {
    try {
      const ok = await new Promise<boolean>((res) => {
        const req = http.get(url, { timeout: 2000 }, (r) => {
          res(r.statusCode === 200)
          r.resume()
        })
        req.on('error', (e) => { lastErr = e.message; res(false) })
        req.on('timeout', () => { req.destroy(); res(false) })
      })
      if (ok) return
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(
    `[processes] ${label} did not become healthy in ${HEALTH_TIMEOUT_MS}ms at ${url} (last: ${lastErr})。` +
      `查看 tests/e2e/.testbed-${label}.log 获取进程输出。`,
  )
}

function startProcess(
  name: string,
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): ChildProcess {
  const logFile = resolve(here, `../.testbed-${name}.log`)
  const out = fs.openSync(logFile, 'a')
  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', out, out],
    // Windows: go run / python 需要 shell 才能解析 PATH
    shell: process.platform === 'win32',
  })
  proc.on('error', (err) => {
    console.error(`[processes] ${name} spawn error:`, err.message)
  })
  return proc
}

function killProcess(proc: ChildProcess | null): void {
  if (!proc || proc.killed) return
  try {
    // Windows: taskkill 杀进程树（go run 会派生编译子进程）
    if (process.platform === 'win32' && proc.pid) {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      proc.kill('SIGTERM')
    }
  } catch { /* already dead */ }
}

export interface ProcessesFixtures {
  processes: ProcessBundle
}

export const test = base.extend<{}, ProcessesFixtures>({
  processes: [
    async ({}, use) => {
      // fail fast：端口被 dev 进程占用时不打错目标
      for (const [port, label] of [[SERVER_PORT, 'server'], [CORE_PORT, 'core'], [WORKER_PORT, 'worker']] as const) {
        if (await portInUse(port)) {
          throw new Error(
            `[processes] port ${port} (${label}) already in use — stop the dev process or ` +
              `set a different port before running the electron testbed`,
          )
        }
      }

      const workspace = fs.mkdtempSync(resolve(os.tmpdir(), 'geowork-e2e-ws-'))
      const dbPath = resolve(os.tmpdir(), `geowork-e2e-${Date.now()}.db`)
      const insecureEnv = { GEOWORK_INSECURE_NO_AUTH: '1' }

      // 1. Cloud server (8767) — auto-register + 放宽限流 + 临时 DB
      const serverBin = process.env.GEOWORK_SERVER_BIN
      const server = serverBin
        ? startProcess('server', serverBin, [], resolve(repoRoot, 'server'), {
            ...insecureEnv,
            GEOWORK_AUTO_REGISTER_ENABLED: 'true',
            GEOWORK_AUTH_RATE_PER_SEC: '1000',
            GEOWORK_AUTH_BURST: '1000',
            GEOWORK_DB_PATH: dbPath,
          })
        : startProcess('server', 'go', ['run', './cmd/geowork-api'], resolve(repoRoot, 'server'), {
            ...insecureEnv,
            GEOWORK_AUTO_REGISTER_ENABLED: 'true',
            GEOWORK_AUTH_RATE_PER_SEC: '1000',
            GEOWORK_AUTH_BURST: '1000',
            GEOWORK_DB_PATH: dbPath,
          })

      // 2. Go core runtime (8765)
      const coreBin = process.env.GEOWORK_CORE_BIN
      const core = coreBin
        ? startProcess('core', coreBin, ['--port', String(CORE_PORT)], resolve(repoRoot, 'core'), insecureEnv)
        : startProcess('core', 'go', ['run', './cmd/geowork-runtime', '--port', String(CORE_PORT)], resolve(repoRoot, 'core'), insecureEnv)

      // 3. Python worker (8766)
      const pythonCmd = process.env.GEOWORK_PYTHON || 'python'
      const worker = startProcess(
        'worker',
        pythonCmd,
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(WORKER_PORT)],
        resolve(repoRoot, 'workers/geo-python'),
        insecureEnv,
      )

      try {
        // 健康门：三个进程都 ready 才放行
        await Promise.all([
          waitForHealth(`http://127.0.0.1:${SERVER_PORT}/health`, 'server'),
          waitForHealth(`http://127.0.0.1:${CORE_PORT}/api/diagnostics/health`, 'core'),
          waitForHealth(`http://127.0.0.1:${WORKER_PORT}/health`, 'worker'),
        ])
      } catch (err) {
        killProcess(server)
        killProcess(core)
        killProcess(worker)
        throw err
      }

      await use({ server, core, worker, workspace, dbPath })

      // teardown: 逆序 kill
      killProcess(worker)
      killProcess(core)
      killProcess(server)

      // 清理临时文件
      try { fs.rmSync(workspace, { recursive: true, force: true }) } catch { /* best effort */ }
      try { fs.unlinkSync(dbPath) } catch { /* best effort */ }
    },
    { scope: 'worker' },
  ],
})
