/** @format */

// GeoWork RuntimeEvents - Full implementation
// Displays streaming runtime events from the task engine with real-time update

import { useEffect, useState, useCallback } from "react";
import { Badge, Tag, Button, Empty, Input } from "antd";
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  SyncOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import sseClient from "../../../../services/sseClient";
import styles from "./RuntimeEvents.module.scss";

const EVENT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  "task.started": {
    icon: <PlayCircleOutlined />,
    color: "#1890ff",
    label: "任务启动",
  },
  "task.progress": {
    icon: <SyncOutlined spin />,
    color: "#722ed1",
    label: "任务进度",
  },
  "task.completed": {
    icon: <CheckCircleOutlined />,
    color: "#52c41a",
    label: "任务完成",
  },
  "task.failed": {
    icon: <CloseCircleOutlined />,
    color: "#f5222d",
    label: "任务失败",
  },
  "task.cancelled": {
    icon: <CloseCircleOutlined />,
    color: "#fa8c16",
    label: "任务取消",
  },
  "tool.call.started": {
    icon: <LoadingOutlined />,
    color: "#13c2c2",
    label: "工具调用",
  },
  "tool.call.completed": {
    icon: <CheckCircleOutlined />,
    color: "#52c41a",
    label: "工具完成",
  },
  "tool.call.failed": {
    icon: <CloseCircleOutlined />,
    color: "#f5222d",
    label: "工具失败",
  },
  "permission.request": {
    icon: <FilterOutlined />,
    color: "#faad14",
    label: "权限请求",
  },
  "permission.approved": {
    icon: <CheckCircleOutlined />,
    color: "#52c41a",
    label: "权限通过",
  },
  "permission.denied": {
    icon: <CloseCircleOutlined />,
    color: "#f5222d",
    label: "权限拒绝",
  },
};

export function RuntimeEvents() {
  const { tasks, currentTask, events, isLoading, error } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [connected, setConnected] = useState(false);

  // Connect to SSE on mount
  useEffect(() => {
    if (!currentTask) {
      setConnected(false);
      return;
    }

    setConnected(true);
    const subscription = sseClient.subscribeTask(currentTask.id, (data) => {
      // Events are handled by taskStore
      console.log("SSE event received:", data);
    });

    return () => {
      subscription.unsubscribe();
      setConnected(false);
    };
  }, [currentTask?.id]);

  const filteredEvents = events
    .filter((evt) => {
      if (eventTypeFilter !== "all" && evt.type !== eventTypeFilter)
        return false;
      if (filter && !evt.message.toLowerCase().includes(filter.toLowerCase()))
        return false;
      return true;
    })
    .reverse();

  const eventTypes = [...new Set(events.map((e) => e.type))];

  const handleClear = () => {
    const { clearMessages } = useChatStore.getState();
    clearMessages();
  };

  if (collapsed) {
    return (
      <button
        className={styles.collapsedBtn}
        onClick={() => setCollapsed(false)}
      >
        <Badge
          count={events.length}
          style={{ backgroundColor: connected ? "#52c41a" : "#d9d9d9" }}
        >
          <span className={styles.collapsedIcon}>⚡</span>
        </Badge>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>⚡ 运行时事件</span>
          <Badge
            status={connected ? "success" : "default"}
            text={connected ? "已连接" : "未连接"}
            style={{ fontSize: 11 }}
          />
        </div>
        <div className={styles.headerRight}>
          <Button
            size="small"
            onClick={handleClear}
          >
            清空
          </Button>
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(true)}
          >
            −
          </button>
        </div>
      </div>

      {/* Filter section */}
      <div className={styles.filterSection}>
        <Input
          size="small"
          placeholder="搜索事件消息..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          prefix={<FilterOutlined style={{ color: "#bfbfbf" }} />}
          className={styles.searchInput}
        />
        <div className={styles.typeFilters}>
          <Button
            size="small"
            type={eventTypeFilter === "all" ? "primary" : "default"}
            onClick={() => setEventTypeFilter("all")}
          >
            全部
          </Button>
          {eventTypes.map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            return (
              <Tag
                key={type}
                color={config?.color || "#999"}
                style={{
                  cursor: "pointer",
                  opacity: eventTypeFilter === type ? 1 : 0.6,
                  margin: 2,
                  fontSize: 10,
                  padding: "0 6px",
                }}
                onClick={() =>
                  setEventTypeFilter(eventTypeFilter === type ? "all" : type)
                }
              >
                {config?.label || type}
              </Tag>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div className={styles.eventList}>
        {filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            <Empty
              description={
                events.length === 0 ? "暂无运行时事件" : "无匹配的事件"
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div className={styles.eventScrollArea}>
            {filteredEvents.map((evt) => {
              const config = EVENT_TYPE_CONFIG[evt.type] || {
                icon: <LoadingOutlined />,
                color: "#999",
                label: evt.type,
              };

              return (
                <div
                  key={evt.id}
                  className={`${styles.eventItem} ${
                    evt.type?.includes("error") || evt.type?.includes("failed")
                      ? styles.eventError
                      : ""
                  }`}
                >
                  <span
                    className={styles.eventIcon}
                    style={{ color: config.color }}
                  >
                    {config.icon}
                  </span>
                  <div className={styles.eventBody}>
                    <div className={styles.eventMessage}>{evt.message}</div>
                    <div className={styles.eventMeta}>
                      <Tag
                        color={config.color}
                        style={{ fontSize: 9, margin: 0 }}
                      >
                        {config.label}
                      </Tag>
                      <span className={styles.eventTime}>
                        {new Date(evt.timestamp).toLocaleTimeString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  {evt.data && (
                    <span className={styles.eventDataBadge}>•••</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className={styles.footer}>
        <span className={styles.footerStat}>共 {events.length} 条事件</span>
        {currentTask && (
          <span className={styles.footerTask}>
            任务: {currentTask.id.slice(0, 8)}
          </span>
        )}
      </div>
    </div>
  );
}

export default RuntimeEvents;
