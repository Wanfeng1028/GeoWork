import { ChildProcess, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

let runtime: ChildProcess | null = null

export async function startRuntime() {
  if (runtime) return
  const root = resolve(__dirname, '../../../')
  runtime = spawn('go', ['run', './cmd/geowork-runtime'], {
    cwd: join(root, 'core'),
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env }
  })
}

export function stopRuntime() {
  if (!runtime) return
  runtime.kill()
  runtime = null
}
