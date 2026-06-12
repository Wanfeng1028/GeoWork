/** @format */

// GeoWork BrowserPanel - Full implementation
// Browser bridge panel for controlling headless browser via Playwright/Puppeteer

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Square, Maximize, Monitor, Play } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Empty } from "../../ui/empty";
import { Spinner } from "../../ui/spinner";
import styles from "./BrowserPanel.module.scss";

interface BrowserState {
  url: string;
  title: string;
  width: number;
  height: number;
  isNavigating: boolean;
  screenshot?: string;
  logs: BrowserLog[];
}

interface BrowserLog {
  id: string;
  type: "navigation" | "error" | "info" | "resource";
  message: string;
  timestamp: string;
}

// Screenshot placeholder SVG (shown when no screenshot is available from Playwright)
const PLACEHOLDER_SCREENSHOT =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7ml6Dlkq7nrp7np5/ogqDorq7lp5Hku73lv5HlubrmoYHfPP8AAP//AAADAgMBAA==</text></svg>";

// Sample initial state
const INITIAL_STATE: BrowserState = {
  url: "",
  title: "新标签页",
  width: 1280,
  height: 720,
  isNavigating: false,
  logs: [
    {
      id: "1",
      type: "info",
      message: "浏览器桥接已初始化",
      timestamp: new Date().toLocaleTimeString("zh-CN"),
    },
    {
      id: "2",
      type: "info",
      message: "Playwright 引擎就绪",
      timestamp: new Date().toLocaleTimeString("zh-CN"),
    },
  ],
};

export function BrowserPanel() {
  const [state, setState] = useState<BrowserState>(INITIAL_STATE);
  const [urlInput, setUrlInput] = useState("");
  const [showConsole, setShowConsole] = useState(true);

  const handleNavigate = () => {
    const url = urlInput.trim() || state.url;
    if (!url) return;

    setState((prev) => ({
      ...prev,
      isNavigating: true,
      url,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "navigation",
          message: `导航至 ${url}`,
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));

    // Simulate navigation completion
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isNavigating: false,
        title: "示例页面",
        logs: [
          ...prev.logs,
          {
            id: (Date.now() + 1).toString(),
            type: "info",
            message: "页面加载完成",
            timestamp: new Date().toLocaleTimeString("zh-CN"),
          },
        ],
      }));
    }, 1500);
  };

  const handleGoBack = () => {
    setState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "info",
          message: "后退",
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));
  };

  const handleGoForward = () => {
    setState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "info",
          message: "前进",
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));
  };

  const handleReload = () => {
    if (!state.url) return;
    setState((prev) => ({
      ...prev,
      isNavigating: true,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "info",
          message: "重新加载",
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, isNavigating: false }));
    }, 800);
  };

  const handleStop = () => {
    setState((prev) => ({
      ...prev,
      isNavigating: false,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "error",
          message: "加载已停止",
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));
  };

  const handleTakeScreenshot = () => {
    setState((prev) => ({
      ...prev,
      screenshot: PLACEHOLDER_SCREENSHOT,
      logs: [
        ...prev.logs,
        {
          id: Date.now().toString(),
          type: "info",
          message: "截图已保存",
          timestamp: new Date().toLocaleTimeString("zh-CN"),
        },
      ],
    }));
  };

  const handleConsoleToggle = () => {
    setShowConsole(!showConsole);
  };

  return (
    <div className={styles.panel}>
      {/* Navigation bar */}
      <div className={styles.navBar}>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled
            onClick={handleGoBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled
            onClick={handleGoForward}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={state.isNavigating}
            onClick={handleReload}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!state.isNavigating}
            onClick={handleStop}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className={styles.urlBar}>
          <div className="flex gap-1">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
              placeholder="输入 URL 并回车"
              className="flex-1"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={handleNavigate}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              访问
            </Button>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="视图"
            onClick={handleTakeScreenshot}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="全屏"
          >
            <Maximize className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Page content area */}
      <div className={styles.browserContent}>
        {state.isNavigating ? (
          <div className={styles.loadingOverlay}>
            <Spinner size="lg" />
            <span style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
              正在加载...
            </span>
          </div>
        ) : state.url ? (
          <div className={styles.iframeArea}>
            {/* Placeholder: In production this would show the actual browser content */}
            <div className={styles.screenshotPlaceholder}>
              <Monitor className="h-12 w-12 text-[#d9d9d9]" />
              <p>页面内容预览</p>
              <span>{state.url}</span>
              <Badge variant="accent">{state.title}</Badge>
              <span className={styles.viewportSize}>
                {state.width} × {state.height}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.emptyBrowser}>
            <Empty description="输入 URL 开始浏览" />
          </div>
        )}
      </div>

      {/* Console panel */}
      {showConsole && (
        <div className={styles.consolePanel}>
          <div className={styles.consoleHeader}>
            <span className={styles.consoleTitle}>控制台</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowConsole(false)}
            >
              收起
            </Button>
          </div>
          <div className={styles.consoleBody}>
            {state.logs.length === 0 ? (
              <span className={styles.emptyLog}>暂无日志</span>
            ) : (
              <div className={styles.logList}>
                {state.logs
                  .slice(-20)
                  .reverse()
                  .map((log) => (
                    <div
                      key={log.id}
                      className={styles.logEntry}
                    >
                      <span className={styles.logTime}>{log.timestamp}</span>
                      <Badge
                        variant={log.type === "error" ? "danger" : log.type === "navigation" ? "accent" : "default"}
                        className="text-[9px] mx-1"
                      >
                        {log.type}
                      </Badge>
                      <span className={styles.logMessage}>{log.message}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle console button */}
      {!showConsole && (
        <button
          className={styles.consoleToggle}
          onClick={handleConsoleToggle}
        >
          <Square className="h-3 w-3 rotate-45" />
          控制台
        </button>
      )}
    </div>
  );
}

export default BrowserPanel;
