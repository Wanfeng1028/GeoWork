import { useEffect, useState } from "react";
import {
  Menu,
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  Search,
  Minus,
  Square,
  X,
  Maximize2,
  RefreshCw,
  MessageSquare,
  Info,
} from "lucide-react";
import useShellStore from "../../../stores/shellStore";
import {
  runAction,
  commandPaletteActions,
} from "../../../services/actionRegistry";
import { toast } from "sonner";
import styles from "./TopBar.module.scss";

function getGeoWorkApi() {
  return (window as any).geowork;
}

function QoderMiniMascot() {
  return (
    <div className={styles.feedbackMascot} aria-hidden="true">
      <span className={styles.feedbackCurl} />
      <span className={`${styles.feedbackEyeWhite} ${styles.feedbackLeftWhite}`} />
      <span className={`${styles.feedbackEyeWhite} ${styles.feedbackRightWhite}`} />
      <span className={`${styles.feedbackEye} ${styles.feedbackLeftEye}`} />
      <span className={`${styles.feedbackEye} ${styles.feedbackRightEye}`} />
      <span className={styles.feedbackBeak} />
    </div>
  )
}
export function TopBar() {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen } =
    useShellStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const api = getGeoWorkApi();
    api?.desktop?.minimizeWindow?.();
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const api = getGeoWorkApi();
    api?.desktop?.toggleMaximizeWindow?.();
    setIsMaximized((value) => !value);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const api = getGeoWorkApi();
    api?.desktop?.closeWindow?.();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        runAction("openCommandPalette");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const checkMaximized = async () => {
      const api = getGeoWorkApi();
      const result = await api?.desktop?.isWindowMaximized?.();
      if (result?.isMaximized !== undefined) {
        setIsMaximized(result.isMaximized);
      }
    };
    checkMaximized();
  }, []);

  return (
    <header className={styles.topbar}>
      {/* Column 1: Left cluster */}
      <div className={styles.left}>
        <div>
          <button asChild>
            <button className={styles.iconBtn} title="菜单">
              <Menu size={15} />
            </button>
          </button>
          <div
            side="bottom"
            align="start"
            sideOffset={4}
            className={styles.appMenuContent}
          >
            <button onClick={() => toast.info("已是最新版本")}>
              <RefreshCw size={14} /> 检查更新
            </button>
            <button onClick={() => setFeedbackOpen(true)}>
              <MessageSquare size={14} /> 问题反馈
            </button>
            <hr />
            <button
              onClick={() => runAction("switchMainModule", "about")}
            >
              <Info size={14} /> 关于
            </button>
          </div>
        </div>

        <button
          className={`${styles.iconBtn} ${sidebarCollapsed ? "" : styles.isSelected}`}
          onClick={() => useShellStore.getState().toggleSidebar()}
          title={sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>

        {sidebarCollapsed && (
          <button
            className={styles.iconBtn}
            onClick={() => runAction("createTask")}
            title="新建任务"
          >
            <Plus size={15} />
          </button>
        )}

        <button
          className={styles.iconBtn}
          onClick={() => runAction("openCommandPalette")}
          title="搜索会话"
        >
          <Search size={15} />
        </button>
      </div>

      {/* Column 2: Drag region */}
      <div className={styles.dragRegion} />

      {/* Column 3: Right actions */}
      <div className={styles.rightActions}>{/* GitHub */}
        <div>
          <button asChild>
            <button
              className={styles.earnPill}
              type="button"
              title="Github"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="15" height="15">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.05.13 3.01.4c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className={styles.earnPillText}>Github</span>
            </button>
          </button>
          <div
            side="bottom"
            align="end"
            sideOffset={8}
            className={styles.githubPopover}
          >
            <div className={styles.githubCard}>
              <div className={styles.githubHero}>
                <div className={styles.githubMark}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.05.13 3.01.4c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.19.69.8.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <strong>Github</strong>
                  <span>Wanfeng1028 / GeoWork</span>
                </div>
              </div>
              <p className={styles.githubDesc}>查看项目源码、更新记录和问题反馈入口。保持本地工作区不变，只在浏览器中打开仓库页面。</p>
              <div className={styles.githubStats}>
                <span><b>main</b><em>当前分支</em></span>
                <span><b>CN</b><em>桌面端</em></span>
                <span><b>MIT</b><em>License</em></span>
              </div>
              <div className={styles.githubActions}>
                <button onClick={() => window.open('https://github.com/Wanfeng1028/GeoWork', '_blank')}>打开 Github</button>
                <button onClick={() => toast.info('稍后接入 issue 列表')}>问题列表</button>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <button
          className={styles.plainAction}
          type="button"
          onClick={() => setFeedbackOpen(true)}
          title="问题反馈"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
            <path
              d="M3.2 3.4h9.6c.55 0 1 .45 1 1v6.1c0 .55-.45 1-1 1H7.15l-2.55 2v-2H3.2c-.55 0-1-.45-1-1V4.4c0-.55.45-1 1-1z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.4 6.4h5.2M5.4 8.7h3.6"
              stroke="currentColor"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.plainActionText}>问题反馈</span>
        </button>

        {/* Usage */}
        <div>
          <button asChild>
            <button className={styles.iconBtn} type="button" title="用量">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="15" height="15">
                <path
                  d="M8 2.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4z"
                  stroke="currentColor"
                />
                <path
                  d="M8 5.2v3l2.1 1.2"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </button>
          <div
            side="bottom"
            align="end"
            sideOffset={6}
            className={styles.usagePopover}
          >
            <div className={styles.usagePanel}>
              <div className={styles.usageHead}>
                <strong>用量概览</strong>
                <button aria-label="关闭" onClick={() => setUsageOpen(false)}>×</button>
              </div>
              {[
                { label: "套餐内 Credits", date: "2026年7月3日 续期", used: "0", total: "2,000", remain: "2,000" },
                { label: "附加 Credits", date: "", used: "0", total: "4,000", remain: "4,000" },
                { label: "Qwen3.7-Max 免费额度", tag: "限时特惠", used: "0", total: "200", remain: "今日剩余 200 次", metric: true },
              ].map((item) => (
                <div className={styles.usageItem} key={item.label}>
                  <div className={styles.usageTitle}>
                    <span>{item.label}</span>
                    {"tag" in item && item.tag && <em>{item.tag}</em>}
                    {item.date && <b>{item.date}</b>}
                  </div>
                  {!("metric" in item) && <div className={styles.usageBars} aria-hidden="true">{Array.from({ length: 46 }).map((_, i) => <i key={i} />)}</div>}
                  <div className={styles.usageNumbers}>
                    <span><strong>{item.used}</strong> / {item.total}（已使用 0%）</span>
                    <span>{"metric" in item ? item.remain : <>剩余 <strong>{item.remain}</strong></>}</span>
                  </div>
                </div>
              ))}
              <div className={styles.usageActions}>
                <button className={styles.usageRefresh} aria-label="刷新用量" onClick={() => toast.info("用量已刷新")}>
                  <RefreshCw size={13} />
                </button>
                <button className={styles.usageDetailButton} onClick={() => toast.info("详情页开发中")}>查看详情 ↗</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column 4: Window controls */}
      <span className={styles.winGap} />
      <div className={styles.windowControls}>
        <button
          className={styles.winBtn}
          onClick={handleMinimize}
          title="最小化"
        >
          <Minus size={12} />
        </button>
        <button
          className={styles.winBtn}
          onClick={handleMaximize}
          title={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="10" height="10" rx="1" />
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="0" y="0" width="11" height="11" rx="1" />
            </svg>
          )}
        </button>
        <button
          className={`${styles.winBtn} ${styles.winClose}`}
          onClick={handleClose}
          title="关闭"
        >
          <X size={12} />
        </button>
      </div>

      {/* Command palette dialog */}
      <div>
        <div >
          <div>
            <div>命令面板</div>
          </div>
          <div >
            {commandPaletteActions.map((action) => (
              <button
                key={action.id}
                
                onClick={() => {
                  setCommandPaletteOpen(false);
                  runAction(
                    action.id,
                    action.id === "openRightDock" ? "task" : undefined,
                  );
                }}
              >
                <div>
                  <div >
                    {action.label}
                  </div>
                  <div >
                    {action.status === "dev" ? action.fallbackMessage : "可用"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback dialog */}
      <div>
        <DialogPortal>
          <DialogPrimitive.Overlay className={styles.feedbackOverlay} />
          <DialogPrimitive.Content className={styles.feedbackCard}>
            <QoderMiniMascot />
            <h3>问题反馈</h3>
            <p>如果您在使用过程中遇到任何问题，请随时反馈给我们。您的反馈将帮助我们不断改进和优化产品。</p>
            <textarea
              placeholder="请输入您的问题或建议"
              onChange={(e) => setFeedbackText(e.target.value)}
              className={styles.feedbackTextarea}
            />
            <label>屏幕截图:</label>
            <div className={styles.uploadRow}>
              <div className={styles.thumbShot} />
              <button className={styles.dropZone} onClick={() => toast.info("截图功能开发中")}>
                <Plus size={18} />
                <span>点击添加，或拖拽/粘贴图片到此区域</span>
              </button>
            </div>
            <label>联系邮箱</label>
            <input
              placeholder="请输入您的邮箱地址"
              onChange={(e) => setFeedbackEmail(e.target.value)}
              className={styles.feedbackInput}
            />
            <div className={styles.feedbackActions}>
              <button onClick={() => setFeedbackOpen(false)}>取消</button>
              <button onClick={() => { toast.info("反馈功能开发中"); setFeedbackOpen(false); }}>提交</button>
            </div>
            <DialogPrimitive.Close className={styles.feedbackClose}><X size={14} /></DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </div>
    </header>
  );
}

