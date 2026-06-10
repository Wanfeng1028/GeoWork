/** @format */

// GeoWork ChatTimeline - Full implementation
// Renders the conversation with messages, tool calls, approvals, and delivery checklists

import { useEffect, useRef, useCallback } from "react";
import { Avatar, Collapse, Tag, Spin, Empty } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import useChatStore from "../../../../stores/chatStore";
import ToolCallBlock from "../../../chat/ToolCallBlock/ToolCallBlock";
import ApprovalCard from "../../../chat/ApprovalCard/ApprovalCard";
import styles from "./ChatTimeline.module.scss";

const { Panel } = Collapse;

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
        <Avatar
          size="small"
          icon={
            isUser ? (
              <UserOutlined />
            ) : isSystem ? (
              <ExclamationCircleOutlined />
            ) : (
              <RobotOutlined />
            )
          }
          className={styles.messageAvatar}
        />
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
        <Spin size="large" />
        <span className={styles.loadingText}>加载对话中...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <Empty
          description="暂无对话记录。在 Composer 中发送任务开始对话"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
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
        <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
        <span className={styles.deliveryTitle}>交付物清单</span>
        <Tag color="green">任务完成</Tag>
      </div>
      <Collapse
        defaultActiveKey={[]}
        bordered={false}
        size="small"
      >
        {categories
          .filter((cat) => cat.items && cat.items.length > 0)
          .map((cat) => (
            <Panel
              header={
                <span className={styles.deliveryCategory}>
                  {cat.label} ({cat.items.length})
                </span>
              }
              key={cat.label}
            >
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
            </Panel>
          ))}
      </Collapse>
    </div>
  );
}

export default ChatTimeline;
