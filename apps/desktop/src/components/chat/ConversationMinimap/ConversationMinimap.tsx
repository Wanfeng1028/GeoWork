/** @format */

// GeoWork ConversationMinimap - Full implementation
// Right-side narrow sidebar showing message anchors for quick navigation

import { useState, useCallback, useRef, useEffect } from "react";
import { Tooltip } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  ToolOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import useChatStore from "../../../stores/chatStore";
import styles from "./ConversationMinimap.module.scss";

type NavItemType =
  | "user-question"
  | "agent-plan"
  | "tool-call"
  | "artifact"
  | "diff"
  | "error"
  | "checkpoint";

const ICON_MAP: Record<NavItemType, React.ReactNode> = {
  "user-question": <UserOutlined />,
  "agent-plan": <RobotOutlined />,
  "tool-call": <ToolOutlined />,
  artifact: <FileTextOutlined />,
  diff: <ToolOutlined />,
  error: <CloseCircleOutlined />,
  checkpoint: <CheckCircleOutlined />,
};

const TOOLTIP_MAP: Record<NavItemType, string> = {
  "user-question": "用户提问",
  "agent-plan": "Agent 计划",
  "tool-call": "工具调用",
  artifact: "产物",
  diff: "差异对比",
  error: "错误",
  checkpoint: "检查点",
};

interface MinimapItem {
  id: string;
  type: NavItemType;
  messageId: string;
  label: string;
}

export function ConversationMinimap() {
  const { navItems, messages } = useChatStore();
  const [isOpen, setIsOpen] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useRef<MinimapItem[]>([]);

  // Build nav items from messages
  useEffect(() => {
    const builtItems: MinimapItem[] = messages
      .filter(
        (msg) =>
          msg.type === "tool_call" ||
          msg.type === "approval" ||
          msg.type === "delivery"
      )
      .map((msg, idx) => ({
        id: msg.id,
        type:
          msg.type === "approval"
            ? "error"
            : msg.type === "delivery"
            ? "checkpoint"
            : "tool-call",
        messageId: msg.id,
        label:
          msg.type === "approval"
            ? "审批"
            : msg.type === "delivery"
            ? "交付物"
            : msg.toolCall?.toolName || "工具调用",
      }));
    items.current = builtItems;
    if (builtItems.length > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [messages.length]);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.querySelector(`[data-message-id="${messageId}"]`);
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
        {items.current.length === 0 ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: 12, color: "#bfbfbf" }}>暂无导航项</span>
          </div>
        ) : (
          <ul className={styles.navList}>
            {items.current.map((item, index) => (
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
              >
                <Tooltip title={item.label}>
                  <span
                    className={`${styles.navIcon} ${
                      styles[`type-${item.type}`]
                    }`}
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
        <span className={styles.itemCount}>{items.current.length} 个节点</span>
      </div>
    </div>
  );
}

export default ConversationMinimap;
