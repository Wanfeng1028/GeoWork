import { ChildProcess, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

let runtime: ChildProcess | null = null

function isPortInUse(port: number): boolean {
  try {
    const result = execSync(`netstat -aon | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' })
    return result.trim().length > 0
  } catch {
    return false
  }
}

export async function startRuntime() {
  if (runtime) return
  
  // 检查端口 8765 是否已被占用（由外部脚本启动的 Go Core）
  if (isPortInUse(8765)) {
    console.log('[GeoWork] Go Core Runtime 已在端口 8765 运行，跳过启动')
    return
  }
  
  const root = resolve(__dirname, '../../../')
  runtime = spawn('go', ['run', './cmd/geowork-runtime', '--port', '8765'], {
    cwd: join(root, 'core'),
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env }
  })
  
  runtime.on('error', (err) => {
    console.error('[GeoWork] Go Core Runtime 启动失败:', err)
    runtime = null
  })
  
  runtime.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[GeoWork] Go Core Runtime 退出，退出码: ${code}`)
    }
    runtime = null
  })
}

export function stopRuntime() {
  if (!runtime) return
  runtime.kill()
  runtime = null
}
