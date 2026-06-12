/** @format */

// GeoWork ChatTimeline - Full implementation
// Renders the conversation with messages, tool calls, approvals, and delivery checklists

import { useEffect, useRef, useCallback } from "react";
import {
  User,
  Bot,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import useChatStore from "../../../../stores/chatStore";
import ToolCallBlock from "../../../chat/ToolCallBlock/ToolCallBlock";
import ApprovalCard from "../../../chat/ApprovalCard/ApprovalCard";
import { Spinner } from "../../../ui/spinner";
import { Empty } from "../../../ui/empty";
import { Badge } from "../../../ui/badge";
import { Separator } from "../../../ui/separator";
import styles from "./ChatTimeline.module.scss";

export function ChatTimeline() {
  const { messages, isLoading, clearMessages } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const renderMessage = (msg: any, index: number) => {
    const isUser = msg.role === "user";
    const isSystem = msg.role === "system";
    const isToolCall = msg.type === "tool_call";
    const isApproval = msg.type === "approval";
    const isDelivery = msg.type === "delivery";

    // Render tool call block
    if (isToolCall && msg.toolCall) {
      return (
        <div
          key={msg.id}
          className={`${styles.toolCallContainer} ${
            isUser ? styles.userToolCall : ""
          }`}
        >
          <ToolCallBlock
            event={msg.toolCall}
          />
        </div>
      );
    }

    // Render approval card
    if (isApproval && msg.approval) {
      return (
        <div
          key={msg.id}
          className={styles.approvalContainer}
        >
          <ApprovalCard request={msg.approval} />
        </div>
      );
    }

    // Render delivery checklist
    if (isDelivery && msg.delivery) {
      return (
        <div
          key={msg.id}
          className={styles.deliveryContainer}
        >
          <DeliveryChecklist delivery={msg.delivery} />
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        className={`${styles.messageRow} ${
          isUser ? styles.userMessage : isSystem ? styles.systemMessage : ""
        }`}
      >
        <div className={`${styles.messageAvatar} flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gw-bg-active)]`}>
          {isUser ? (
            <User className="h-3.5 w-3.5" />
          ) : isSystem ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
        </div>
        <div className={styles.messageContent}>
          <div className={styles.messageHeader}>
            <span className={styles.messageRole}>
              {isUser ? "你" : isSystem ? "系统" : "GeoWork Agent"}
            </span>
            <span className={styles.messageTime}>
              {formatTime(msg.timestamp)}
            </span>
          </div>
          <div className={styles.messageBody}>{msg.content || "暂无内容"}</div>
        </div>
      </div>
    );
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <span className={styles.loadingText}>加载对话中...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Empty
          description="暂无对话记录。在 Composer 中发送任务开始对话"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.timeline}
    >
      <div className={styles.messageList}>
        {messages.map((msg, index) => renderMessage(msg, index))}
        <div ref={messagesEndRef} />
      </div>
      {messages.length > 0 && (
        <button
          className={styles.clearButton}
          onClick={clearMessages}
        >
          清空对话
        </button>
      )}
    </div>
  );
}

// Delivery checklist sub-component
function DeliveryChecklist({ delivery }: { delivery: any }) {
  const categories = [
    { label: "地图", items: delivery.maps },
    { label: "代码", items: delivery.codes },
    { label: "文档", items: delivery.documents },
    { label: "数据", items: delivery.datasets },
    { label: "日志", items: delivery.logs },
  ];

  return (
    <div className={styles.deliveryChecklist}>
      <div className={styles.deliveryHeader}>
        <CheckCircle style={{ color: "#52c41a", fontSize: 16 }} className="h-4 w-4" />
        <span className={styles.deliveryTitle}>交付物清单</span>
        <Badge variant="success">任务完成</Badge>
      </div>
      <div className="flex flex-col gap-1">
        {categories
          .filter((cat) => cat.items && cat.items.length > 0)
          .map((cat) => (
            <details key={cat.label}>
              <summary className="cursor-pointer py-1">
                <span className={styles.deliveryCategory}>
                  {cat.label} ({cat.items.length})
                </span>
              </summary>
              <ul className={styles.deliveryList}>
                {cat.items?.map((item: string, i: number) => (
                  <li
                    key={i}
                    className={styles.deliveryItem}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          ))}
      </div>
    </div>
  );
}

export default ChatTimeline;
