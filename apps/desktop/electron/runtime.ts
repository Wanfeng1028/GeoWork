import { ChildProcess, spawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

let goRuntime: ChildProcess | null = null;
let cloudServer: ChildProcess | null = null;

function isPortInUse(port: number): boolean {
  try {
    const result = execSync(`netstat -aon | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' })
    return result.trim().length > 0
  } catch {
    return false
  }
}

export async function startRuntime() {
  if (goRuntime) return;

  // 检查端口 8765 是否已被占用（由外部脚本启动的 Go Core）
  if (isPortInUse(8765)) {
    console.log("[GeoWork] Go Core Runtime 已在端口 8765 运行，跳过启动");
  } else {
    const root = resolve(__dirname, "../../../");
    goRuntime = spawn(
      "go",
      ["run", "./cmd/geowork-runtime", "--port", "8765"],
      {
        cwd: join(root, "core"),
        stdio: "ignore",
        windowsHide: true,
        env: { ...process.env },
      }
    );

    goRuntime.on("error", (err) => {
      console.error("[GeoWork] Go Core Runtime 启动失败:", err);
      goRuntime = null;
    });

    goRuntime.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[GeoWork] Go Core Runtime 退出，退出码: ${code}`);
      }
      goRuntime = null;
    });
  }

  // 检查 Cloud Server (端口 8767)
  if (isPortInUse(8767)) {
    console.log("[GeoWork] Cloud Server 已在端口 8767 运行，跳过启动");
  } else {
    const root = resolve(__dirname, "../../../");
    cloudServer = spawn("go", ["run", "./cmd/geowork-api"], {
      cwd: join(root, "server"),
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env },
    });

    cloudServer.on("error", (err) => {
      console.error("[GeoWork] Cloud Server 启动失败:", err);
      cloudServer = null;
    });

    cloudServer.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[GeoWork] Cloud Server 退出，退出码: ${code}`);
      }
      cloudServer = null;
    });
  }
}

export function stopRuntime() {
  if (goRuntime) {
    goRuntime.kill();
    goRuntime = null;
  }
  if (cloudServer) {
    cloudServer.kill();
    cloudServer = null;
  }
}

export function getCloudServerStatus() {
  return cloudServer ? "running" : "stopped";
}
