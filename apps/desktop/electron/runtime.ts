import { ChildProcess, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import { ipcMain } from 'electron'
import { getLogFilePath, writeLog } from './local/logging'

let goRuntime: ChildProcess | null = null
let cloudServer: ChildProcess | null = null

// Track pids for graceful shutdown
let goPid: number | null = null
let cloudPid: number | null = null

// Startup state
const startupState = {
  goCore: 'unknown' as 'starting' | 'running' | 'stopped' | 'failed',
  cloudServer: 'unknown' as 'starting' | 'running' | 'stopped' | 'failed',
  goError: '' as string,
  cloudError: '' as string,
}

/**
 * Cross-platform port detection
 * Windows: netstat -aon | findstr :port | findstr LISTENING
 * macOS/Linux: lsof -ti :port
 */
function isPortInUse(port: number): boolean {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      const result = execSync(`netstat -aon | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' })
      return result.trim().length > 0
    } else if (platform === 'darwin' || platform === 'linux') {
      const result = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' })
      return result.trim().length > 0
    }
    return false
  } catch {
    return false
  }
}

/**
 * Health check for Go Core Runtime on port 8765
 */
async function checkGoCoreHealth(): Promise<boolean> {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      const result = execSync('powershell -command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $webclient = New-Object Net.WebClient; $webclient.DownloadString(\'http://127.0.0.1:8765/api/diagnostics/health\') } catch { $null }"', { encoding: 'utf-8' })
      return result.includes('health')
    } else {
      const result = execSync(`curl -s --connect-timeout 5 http://127.0.0.1:8765/api/diagnostics/health 2>/dev/null || echo "FAILED"`, { encoding: 'utf-8' })
      return !result.includes('FAILED') && result.includes('health')
    }
  } catch {
    return false
  }
}

/**
 * Health check for Cloud Server on port 8767
 */
async function checkCloudServerHealth(): Promise<boolean> {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      const result = execSync('powershell -command "try { $webclient = New-Object Net.WebClient; $webclient.DownloadString(\'http://127.0.0.1:8767/api/diagnostics/health\') } catch { $null }"', { encoding: 'utf-8' })
      return result.includes('health')
    } else {
      const result = execSync(`curl -s --connect-timeout 5 http://127.0.0.1:8767/api/diagnostics/health 2>/dev/null || echo "FAILED"`, { encoding: 'utf-8' })
      return !result.includes('FAILED') && result.includes('health')
    }
  } catch {
    return false
  }
}

/**
 * Notify renderer about startup status via IPC
 */
function notifyStartupStatus(service: 'goCore' | 'cloudServer', status: 'running' | 'failed', error?: string) {
  const windows = require('electron').BrowserWindow.getAllWindows()
  windows.forEach((win: any) => {
    win.webContents.send('runtime:status-change', {
      service,
      status,
      error: error || null,
      timestamp: Date.now(),
    })
  })
}

/**
 * Log stdout/stderr to a file
 */
function logChildOutput(child: ChildProcess, type: 'goCore' | 'cloudServer') {
  const logFile = getLogFilePath(type === 'goCore' ? 'runtime' : 'runtime')
  
  child.stdout?.on('data', (data: Buffer) => {
    const line = data.toString('utf-8').trim()
    if (line) {
      const timestamp = new Date().toISOString()
      writeLog('runtime', `[${type}] ${line}`)
      fs.appendFileSync(logFile, `[${timestamp}] [${type}] ${line}\n`, 'utf-8')
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString('utf-8').trim()
    if (line) {
      const timestamp = new Date().toISOString()
      writeLog('error', `[${type}] ${line}`)
      fs.appendFileSync(logFile, `[${timestamp}] [${type}] [stderr] ${line}\n`, 'utf-8')
    }
  })
}

/**
 * Start Go Core and Cloud Server
 * Prevents duplicate startup, logs output, health checks, graceful shutdown
 */
export async function startRuntime() {
  // Prevent duplicate startup
  if (startupState.goCore === 'starting' || startupState.cloudServer === 'starting') {
    console.log('[GeoWork] Runtime is already starting, skipping duplicate request')
    return
  }

  startupState.goCore = 'starting'
  startupState.cloudServer = 'starting'
  writeLog('main', 'Starting GeoWork runtime...')

  // --- Start Go Core Runtime ---
  
  // Check if port 8765 is already in use (started by external script)
  if (isPortInUse(8765)) {
    startupState.goCore = 'running'
    console.log('[GeoWork] Go Core Runtime is already running on port 8765, skipping startup')
    writeLog('main', 'Go Core Runtime already running on port 8765')
    notifyStartupStatus('goCore', 'running')
  } else {
    const root = resolve(__dirname, '../../../')
    const logFile = getLogFilePath('runtime')
    
    goRuntime = spawn(
      'go',
      ['run', './cmd/geowork-runtime', '--port', '8765'],
      {
        cwd: join(root, 'core'),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env },
      }
    )

    goPid = goRuntime.pid ?? null
    console.log(`[GeoWork] Starting Go Core Runtime (PID: ${goPid})...`)
    writeLog('main', `Starting Go Core Runtime with PID ${goPid}`)
    logChildOutput(goRuntime, 'goCore')

    goRuntime.on('error', (err) => {
      startupState.goCore = 'failed'
      startupState.goError = err.message
      console.error('[GeoWork] Go Core Runtime failed to start:', err)
      writeLog('error', `Go Core Runtime failed: ${err.message}`)
      notifyStartupStatus('goCore', 'failed', err.message)
      goRuntime = null
      goPid = null
    })

    goRuntime.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        startupState.goCore = 'failed'
        startupState.goError = `Exited with code ${code} (signal: ${signal})`
        console.error(`[GeoWork] Go Core Runtime exited with code: ${code}`)
        writeLog('error', `Go Core Runtime exited with code ${code}, signal: ${signal}`)
        notifyStartupStatus('goCore', 'failed', `Exit code: ${code}`)
      } else if (signal) {
        startupState.goCore = 'stopped'
        console.log(`[GeoWork] Go Core Runtime stopped by signal: ${signal}`)
        writeLog('main', `Go Core Runtime stopped by signal: ${signal}`)
        notifyStartupStatus('goCore', 'stopped')
      } else {
        startupState.goCore = 'stopped'
      }
      goRuntime = null
      goPid = null
    })
  }

  // --- Start Cloud Server ---

  if (isPortInUse(8767)) {
    startupState.cloudServer = 'running'
    console.log('[GeoWork] Cloud Server is already running on port 8767, skipping startup')
    writeLog('main', 'Cloud Server already running on port 8767')
    notifyStartupStatus('cloudServer', 'running')
  } else {
    const root = resolve(__dirname, '../../../')
    
    cloudServer = spawn(
      'go',
      ['run', './cmd/geowork-api'],
      {
        cwd: join(root, 'server'),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env },
      }
    )

    cloudPid = cloudServer.pid ?? null
    console.log(`[GeoWork] Starting Cloud Server (PID: ${cloudPid})...`)
    writeLog('main', `Starting Cloud Server with PID ${cloudPid}`)
    logChildOutput(cloudServer, 'cloudServer')

    cloudServer.on('error', (err) => {
      startupState.cloudServer = 'failed'
      startupState.cloudError = err.message
      console.error('[GeoWork] Cloud Server failed to start:', err)
      writeLog('error', `Cloud Server failed: ${err.message}`)
      notifyStartupStatus('cloudServer', 'failed', err.message)
      cloudServer = null
      cloudPid = null
    })

    cloudServer.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        startupState.cloudServer = 'failed'
        startupState.cloudError = `Exited with code ${code} (signal: ${signal})`
        console.error(`[GeoWork] Cloud Server exited with code: ${code}`)
        writeLog('error', `Cloud Server exited with code ${code}, signal: ${signal}`)
        notifyStartupStatus('cloudServer', 'failed', `Exit code: ${code}`)
      } else if (signal) {
        startupState.cloudServer = 'stopped'
        console.log(`[GeoWork] Cloud Server stopped by signal: ${signal}`)
        writeLog('main', `Cloud Server stopped by signal: ${signal}`)
        notifyStartupStatus('cloudServer', 'stopped')
      } else {
        startupState.cloudServer = 'stopped'
      }
      cloudServer = null
      cloudPid = null
    })
  }
}

/**
 * Gracefully stop all runtime services
 */
export function stopRuntime() {
  writeLog('main', 'Stopping GeoWork runtime...')

  // Stop Go Core with SIGTERM first, then SIGKILL after timeout
  if (goRuntime && goPid) {
    try {
      console.log(`[GeoWork] Sending SIGTERM to Go Core (PID: ${goPid})...`)
      process.kill(goPid, 'SIGTERM')
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (goRuntime && !goRuntime.killed) {
          console.log(`[GeoWork] Go Core didn't exit, sending SIGKILL...`)
          goRuntime.kill('SIGKILL')
        }
      }, 5000)
    } catch (err) {
      console.log(`[GeoWork] Go Core process ${goPid} not found, skipping`)
    }
    goRuntime = null
    goPid = null
  }

  // Stop Cloud Server with SIGTERM first
  if (cloudServer && cloudPid) {
    try {
      console.log(`[GeoWork] Sending SIGTERM to Cloud Server (PID: ${cloudPid})...`)
      process.kill(cloudPid, 'SIGTERM')
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (cloudServer && !cloudServer.killed) {
          console.log(`[GeoWork] Cloud Server didn't exit, sending SIGKILL...`)
          cloudServer.kill('SIGKILL')
        }
      }, 5000)
    } catch (err) {
      console.log(`[GeoWork] Cloud Server process ${cloudPid} not found, skipping`)
    }
    cloudServer = null
    cloudPid = null
  }

  startupState.goCore = 'stopped'
  startupState.cloudServer = 'stopped'
  writeLog('main', 'GeoWork runtime stopped')
}

/**
 * Get current runtime status
 */
export function getRuntimeStatus() {
  return {
    goCore: {
      status: startupState.goCore,
      error: startupState.goError,
      pid: goPid,
    },
    cloudServer: {
      status: startupState.cloudServer,
      error: startupState.cloudError,
      pid: cloudPid,
    },
  }
}

/**
 * Check health of Go Core and Cloud Server
 */
export async function checkHealth() {
  const [goCoreHealthy, cloudServerHealthy] = await Promise.all([
    checkGoCoreHealth(),
    checkCloudServerHealth(),
  ])

  return {
    goCore: goCoreHealthy ? 'healthy' : 'unhealthy',
    cloudServer: cloudServerHealthy ? 'healthy' : 'unhealthy',
    timestamp: Date.now(),
  }
}

/**
 * Export startup state for IPC
 */
export { startupState }
