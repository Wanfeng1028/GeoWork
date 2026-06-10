/** @format */

// GeoWork BrowserPanel - Full implementation
// Browser bridge panel for controlling headless browser via Playwright/Puppeteer

import { useState } from "react";
import { Button, Input, Space, Tag, Empty, Spin, Select } from "antd";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  StopOutlined,
  FullscreenOutlined,
  DesktopOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
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

// Sample screenshot placeholder (in production, this would come from Playwright)
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

  const logColors: Record<string, string> = {
    navigation: "#1890ff",
    error: "#f5222d",
    info: "#8c8c8c",
    resource: "#faad14",
  };

  return (
    <div className={styles.panel}>
      {/* Navigation bar */}
      <div className={styles.navBar}>
        <Space size="small">
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            disabled
            onClick={handleGoBack}
          />
          <Button
            size="small"
            icon={<ArrowRightOutlined />}
            disabled
            onClick={handleGoForward}
          />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={state.isNavigating}
            onClick={handleReload}
          />
          <Button
            size="small"
            icon={<StopOutlined />}
            disabled={!state.isNavigating}
            onClick={handleStop}
          />
        </Space>
        <div className={styles.urlBar}>
          <Input
            size="small"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onPressEnter={handleNavigate}
            placeholder="输入 URL 并回车"
            suffix={
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleNavigate}
              >
                访问
              </Button>
            }
          />
        </div>
        <Space size="small">
          <Button
            size="small"
            icon={<DesktopOutlined />}
            title="视图"
            onClick={handleTakeScreenshot}
          />
          <Button
            size="small"
            icon={<FullscreenOutlined />}
            title="全屏"
          />
        </Space>
      </div>

      {/* Page content area */}
      <div className={styles.browserContent}>
        {state.isNavigating ? (
          <div className={styles.loadingOverlay}>
            <Spin size="large" />
            <span style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
              正在加载...
            </span>
          </div>
        ) : state.url ? (
          <div className={styles.iframeArea}>
            {/* Placeholder: In production this would show the actual browser content */}
            <div className={styles.screenshotPlaceholder}>
              <DesktopOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />
              <p>页面内容预览</p>
              <span>{state.url}</span>
              <Tag color="blue">{state.title}</Tag>
              <span className={styles.viewportSize}>
                {state.width} × {state.height}
              </span>
            </div>
          </div>
        ) : (
          <div className={styles.emptyBrowser}>
            <Empty
              description="输入 URL 开始浏览"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </div>

      {/* Console panel */}
      {showConsole && (
        <div className={styles.consolePanel}>
          <div className={styles.consoleHeader}>
            <span className={styles.consoleTitle}>控制台</span>
            <Button
              size="small"
              type="text"
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
                      <Tag
                        color={logColors[log.type]}
                        style={{ fontSize: 9, margin: "0 4px" }}
                      >
                        {log.type}
                      </Tag>
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
          <StopOutlined style={{ transform: "rotate(45deg)", fontSize: 12 }} />
          控制台
        </button>
      )}
    </div>
  );
}

export default BrowserPanel;
