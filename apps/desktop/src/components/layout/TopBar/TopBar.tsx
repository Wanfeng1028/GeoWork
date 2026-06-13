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
  ExternalLink,
} from "lucide-react";
import useShellStore from "../../../stores/shellStore";
import {
  runAction,
  commandPaletteActions,
} from "../../../services/actionRegistry";
import { GeoMascot } from "../../brand/GeoMascot";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../ui/dialog";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { toast } from "sonner";
import styles from "./TopBar.module.scss";

function getGeoWorkApi() {
  return (window as any).geowork;
}

function UsageRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.usageRow}>
      <span>{label}</span>
      <strong className={accent ? styles.green : ""}>{value}</strong>
    </div>
  );
}

export function TopBar() {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen } =
    useShellStore();
  const [isMaximized, setIsMaximized] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.iconBtn} title="菜单">
              <Menu size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            sideOffset={4}
            className={styles.appMenuContent}
          >
            <DropdownMenuItem onClick={() => toast.info("已是最新版本")}>
              <RefreshCw size={14} /> 检查更新
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
              <MessageSquare size={14} /> 问题反馈
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => runAction("switchMainModule", "about")}
            >
              <Info size={14} /> 关于
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          className={styles.iconBtn}
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
      <div className={styles.rightActions}>
        {/* GitHub Star */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={styles.starButton}
              type="button"
              title="给 GitHub 点 Star"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="15" height="15">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className={styles.starText}>Github</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={6}
            className={styles.starPopover}
          >
            <div className={styles.starPopoverInner}>
              <GeoMascot size="md" state="idle" />
              <div>
                <h3>喜欢 GeoWork？给项目点个 Star</h3>
                <p>
                  你的 Star
                  会帮助项目被更多人看到，也会鼓励后续继续完善桌面端、Agent
                  工作流和地理分析能力。
                </p>
              </div>
              <div className={styles.popoverActions}>
                <Button
                  variant="primary"
                  size="sm"
                  className={styles.popoverMainButton}
                  onClick={() =>
                    window.open(
                      "https://github.com/Wanfeng1028/GeoWork",
                      "_blank",
                    )
                  }
                >
                  <ExternalLink size={13} /> 打开 GitHub
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.info("贡献指南开发中")}
                >
                  查看项目
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Feedback */}
        <button
          className={styles.feedbackButton}
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
          <span className={styles.feedbackText}>问题反馈</span>
        </button>

        {/* Usage */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={styles.usageButton} type="button" title="用量">
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
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={6}
            className={styles.usagePopover}
          >
            <div className={styles.usageContent}>
              <h4>用量概览</h4>
              <UsageRow label="本地任务额度" value="无限" />
              <UsageRow label="Agent 调用额度" value="1,280 / 2,000" />
              <UsageRow label="地理分析额度" value="45 / 100" />
              <UsageRow label="今日剩余" value="87 次" accent />
              <Button
                variant="ghost"
                size="sm"
                className={styles.usageDetailButton}
                onClick={() => toast.info("详情页开发中")}
              >
                查看详情
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Column 4: Window controls */}
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
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>命令面板</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {commandPaletteActions.map((action) => (
              <button
                key={action.id}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-[var(--gw-bg-hover)] transition-colors"
                onClick={() => {
                  setCommandPaletteOpen(false);
                  runAction(
                    action.id,
                    action.id === "openRightDock" ? "task" : undefined,
                  );
                }}
              >
                <div>
                  <div className="text-[13px] text-[var(--gw-text)]">
                    {action.label}
                  </div>
                  <div className="text-[11px] text-[var(--gw-text-tertiary)]">
                    {action.status === "dev" ? action.fallbackMessage : "可用"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogPortal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--gw-z-modal)] bg-[var(--gw-overlay-bg,rgba(8,8,7,0.62))] backdrop-blur-[10px] backdrop-saturate-110 data-[state=open]:animate-[gw-fade-in_160ms_ease-out] data-[state=closed]:animate-[gw-fade-out_120ms_ease-in]" />
          <DialogPrimitive.Content
            ref={undefined}
            className="fixed left-1/2 top-1/2 z-[var(--gw-z-modal)] -translate-x-1/2 -translate-y-1/2 w-full max-w-[520px] rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a18] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.55)] data-[state=open]:animate-[gw-scale-in_160ms_var(--gw-ease-out)] data-[state=closed]:animate-[gw-fade-out_120ms_ease-in] focus-visible:outline-none"
          >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-[16px] font-semibold text-[#e8e8e3] leading-tight">问题反馈</h2>
            <p className="text-[12px] text-[#8a8a86] leading-[1.7] mt-2">
              如果您在使用过程中遇到任何问题，请随时反馈给我们。您的反馈将帮助我们不断改进和优化产品。
            </p>
          </div>

          {/* Body */}
          <div className="px-6 pb-2 flex flex-col gap-4">
            {/* Textarea */}
            <div className="rounded-[10px] bg-[#151512] border border-[rgba(255,255,255,0.08)] overflow-hidden">
              <Textarea
                placeholder="请输入您的问题或建议"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                className="bg-transparent border-0 resize-none text-[13px] text-[#e8e8e3] placeholder-[#5a5a56] leading-[1.7] focus-visible:ring-0"
              />
            </div>

            {/* Screenshot area */}
            <div>
              <div className="text-[12px] text-[#8a8a86] mb-2">屏幕截图：</div>
              <div className="flex gap-3">
                {/* Screenshot thumbnail placeholder */}
                <div className="w-[140px] h-[96px] rounded-[8px] bg-[#2a2a27] border border-[rgba(255,255,255,0.06)] overflow-hidden flex-shrink-0">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-[120px] h-[72px] bg-[#1a1a18] rounded-[4px] border border-[rgba(255,255,255,0.04)]" />
                  </div>
                </div>
                {/* Add screenshot button */}
                <button
                  data-feedback-ignore="true"
                  type="button"
                  className="flex-1 h-[96px] rounded-[8px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                  onClick={() => toast.info("截图功能开发中")}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4v12M4 10h12" stroke="#5a5a56" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[11px] text-[#5a5a56] text-center leading-[1.5]">点击添加，或拖拽/
粘贴图片到此区域</span>
                </button>
              </div>
            </div>

            {/* Email */}
            <div>
              <div className="text-[12px] text-[#8a8a86] mb-2">联系邮箱</div>
              <div className="relative">
                <Input
                  placeholder="请输入您的邮箱地址"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  className="h-[36px] bg-[#151512] border border-[rgba(255,255,255,0.08)] rounded-[8px] text-[13px] text-[#e8e8e3] placeholder-[#5a5a56] focus-visible:ring-0 pl-3.5 pr-3.5"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-3 flex justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3.5 text-[13px] text-[#8a8a86] hover:text-[#e8e8e3] hover:bg-[rgba(255,255,255,0.06)] rounded-full"
              onClick={() => setFeedbackOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="h-8 px-4 text-[13px] bg-[#3a3a36] hover:bg-[#4a4a46] text-[#e8e8e3] rounded-full border border-[rgba(255,255,255,0.08)]"
              onClick={() => {
                toast.info("反馈功能开发中");
                setFeedbackOpen(false);
              }}
            >
              提交
            </Button>
          </div>
          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-2 text-[var(--gw-text-tertiary)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--gw-text-secondary)] transition-colors">
            <X className="h-3.5 w-3.5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </header>
  );
}
