/** @format */

// GeoWork ConversationMinimap - Extended with real event types
// Right-side narrow sidebar showing message anchors for quick navigation

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Tooltip } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  ToolOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  PauseCircleOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import useChatStore from "../../../stores/chatStore";
import useTaskStore from "../../../stores/taskStore";
import type { RuntimeEvent } from "../../../types/task";
import styles from "./ConversationMinimap.module.scss";

export type NavItemType =
  | "user-question"
  | "agent-plan"
  | "tool-call"
  | "artifact"
  | "diff"
  | "error"
  | "checkpoint"
  | "permission"
  | "task-started"
  | "task-completed"
  | "step-start";

const ICON_MAP: Record<NavItemType, React.ReactNode> = {
  "user-question": <UserOutlined />,
  "agent-plan": <RobotOutlined />,
  "tool-call": <ToolOutlined />,
  artifact: <FileTextOutlined />,
  diff: <FileSearchOutlined />,
  error: <CloseCircleOutlined />,
  checkpoint: <CheckCircleOutlined />,
  permission: <WarningOutlined />,
  "task-started": <ThunderboltOutlined />,
  "task-completed": <CheckCircleOutlined />,
  "step-start": <PauseCircleOutlined />,
};

const TOOLTIP_MAP: Record<NavItemType, string> = {
  "user-question": "用户提问",
  "agent-plan": "Agent 计划",
  "tool-call": "工具调用",
  artifact: "产物",
  diff: "差异对比",
  error: "错误",
  checkpoint: "检查点",
  permission: "权限请求",
  "task-started": "任务开始",
  "task-completed": "任务完成",
  "step-start": "步骤执行",
};

const COLOR_MAP: Record<NavItemType, string> = {
  "user-question": "#1890ff",
  "agent-plan": "#722ed1",
  "tool-call": "#fa8c16",
  artifact: "#52c41a",
  diff: "#13c2c2",
  error: "#f5222d",
  checkpoint: "#52c41a",
  permission: "#faad14",
  "task-started": "#1890ff",
  "task-completed": "#52c41a",
  "step-start": "#722ed1",
};

interface MinimapItem {
  id: string;
  type: NavItemType;
  messageId: string;
  label: string;
  summary?: string;
  timestamp?: string;
}

/**
 * Map SSE RuntimeEvent types to NavItemType
 */
function eventToNavItem(event: RuntimeEvent): MinimapItem | null {
  const { type, message, id, timestamp } = event;

  if (type === "task.started") {
    return { id: `event-${id}`, type: "task-started", messageId: `event-${id}`, label: "任务开始", summary: message, timestamp };
  }
  if (type === "task.completed") {
    return { id: `event-${id}`, type: "task-completed", messageId: `event-${id}`, label: "任务完成", summary: message, timestamp };
  }
  if (type === "task.failed") {
    return { id: `event-${id}`, type: "error", messageId: `event-${id}`, label: "任务失败", summary: message || "任务执行失败", timestamp };
  }
  if (type.startsWith("step_start") || type.startsWith("tool.call.started")) {
    const toolName = (event.data?.toolName as string) || "步骤";
    return { id: `event-${id}`, type: "step-start", messageId: `event-${id}`, label: `步骤: ${toolName}`, summary: message, timestamp };
  }
  if (type.startsWith("permission.required")) {
    return { id: `event-${id}`, type: "permission", messageId: `event-${id}`, label: "权限请求", summary: message || "需要权限审批", timestamp };
  }
  if (type.startsWith("artifact.created")) {
    const name = (event.data?.name as string) || "产物";
    return { id: `event-${id}`, type: "artifact", messageId: `event-${id}`, label: `产物: ${name}`, summary: message, timestamp };
  }
  if (type.startsWith("diff.created")) {
    return { id: `event-${id}`, type: "diff", messageId: `event-${id}`, label: "文件变更", summary: message || "检测到文件差异", timestamp };
  }
  return null;
}

export function ConversationMinimap() {
  const { navItems, messages } = useChatStore();
  const { events } = useTaskStore();
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useRef<MinimapItem[]>([]);

  // Build nav items from chat messages + SSE events
  const builtItems = useMemo<MinimapItem[]>(() => {
    const allItems: MinimapItem[] = [];

    // 1. From chat messages
    for (const msg of messages) {
      if (msg.type === "text" && msg.role === "user") {
        allItems.push({
          id: `msg-${msg.id}`,
          type: "user-question",
          messageId: msg.id,
          label: "用户消息",
          summary: msg.content.slice(0, 50),
          timestamp: msg.timestamp,
        });
      } else if (msg.type === "tool_call") {
        allItems.push({
          id: `msg-${msg.id}`,
          type: "tool-call",
          messageId: msg.id,
          label: msg.toolCall?.toolName || "工具调用",
          summary: msg.content,
          timestamp: msg.timestamp,
        });
      } else if (msg.type === "approval") {
        allItems.push({
          id: `msg-${msg.id}`,
          type: "permission",
          messageId: msg.id,
          label: "审批请求",
          summary: msg.approval?.title || "需要审批",
          timestamp: msg.timestamp,
        });
      } else if (msg.type === "delivery") {
        allItems.push({
          id: `msg-${msg.id}`,
          type: "checkpoint",
          messageId: msg.id,
          label: "交付物",
          summary: "任务交付清单",
          timestamp: msg.timestamp,
        });
      }
    }

    // 2. From SSE events
    for (const event of events) {
      const item = eventToNavItem(event);
      if (item && !allItems.find(i => i.id === item.id)) {
        allItems.push(item);
      }
    }

    // Sort by timestamp if available
    allItems.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    });

    return allItems;
  }, [messages.length, events.length]);

  // Keep ref in sync
  useEffect(() => {
    items.current = builtItems;
    if (builtItems.length > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [builtItems, isOpen]);

  const scrollToMessage = useCallback((messageId: string) => {
    // Try data-message-id first, then data-minimap-id
    const element = document.querySelector(`[data-message-id="${messageId}"]`)
      || document.querySelector(`[data-minimap-id="${messageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  if (!isOpen) {
    return (
      <div
        className={styles.collapsedTrigger}
        onClick={() => setIsOpen(true)}
      >
        <div className={styles.triggerIcon}>▸</div>
        <span className={styles.triggerBadge}>{items.current.length}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.minimap}
    >
      <div className={styles.minimapHeader}>
        <span className={styles.minimapTitle}>对话导航</span>
        <button
          className={styles.closeButton}
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
      </div>

      <div className={styles.minimapBody}>
        {builtItems.length === 0 ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: 12, color: "#bfbfbf" }}>暂无导航项</span>
          </div>
        ) : (
          <ul className={styles.navList}>
            {builtItems.map((item, index) => (
              <li
                key={item.id}
                className={`${styles.navItem} ${
                  hoveredIndex === index ? styles.hovered : ""
                } ${activeIndex === index ? styles.active : ""}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  setActiveIndex(index);
                  scrollToMessage(item.messageId);
                }}
                data-minimap-id={item.id}
              >
                <Tooltip
                  title={
                    <div>
                      <div>{TOOLTIP_MAP[item.type]}</div>
                      {item.summary && (
                        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                          {item.summary.slice(0, 40)}
                          {item.summary.length > 40 ? "..." : ""}
                        </div>
                      )}
                    </div>
                  }
                  placement="left"
                >
                  <span
                    className={`${styles.navIcon} ${
                      styles[`type-${item.type}`]
                    }`}
                    style={{ color: COLOR_MAP[item.type] }}
                  >
                    {ICON_MAP[item.type]}
                  </span>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.minimapFooter}>
        <span className={styles.itemCount}>{builtItems.length} 个节点</span>
      </div>
    </div>
  );
}

export default ConversationMinimap;
