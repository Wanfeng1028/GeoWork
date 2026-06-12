/** @format */

// GeoWork RuntimeEvents - Full implementation
// Displays streaming runtime events from the task engine with real-time update

import { useEffect, useState, useCallback } from "react";
import { Play, CheckCircle, XCircle, Loader2, RefreshCw, Filter } from "lucide-react";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { Empty } from "../../../ui/empty";
import { Input } from "../../../ui/input";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import sseClient from "../../../../services/sseClient";
import styles from "./RuntimeEvents.module.scss";

const EVENT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  "task.started": {
    icon: <Play className="h-3.5 w-3.5" />,
    color: "#1890ff",
    label: "任务启动",
  },
  "task.progress": {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "#722ed1",
    label: "任务进度",
  },
  "task.completed": {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: "#52c41a",
    label: "任务完成",
  },
  "task.failed": {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "#f5222d",
    label: "任务失败",
  },
  "task.cancelled": {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "#fa8c16",
    label: "任务取消",
  },
  "tool.call.started": {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "#13c2c2",
    label: "工具调用",
  },
  "tool.call.completed": {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: "#52c41a",
    label: "工具完成",
  },
  "tool.call.failed": {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "#f5222d",
    label: "工具失败",
  },
  "permission.request": {
    icon: <Filter className="h-3.5 w-3.5" />,
    color: "#faad14",
    label: "权限请求",
  },
  "permission.approved": {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: "#52c41a",
    label: "权限通过",
  },
  "permission.denied": {
    icon: <XCircle className="h-3.5 w-3.5" />,
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
        <span className="relative inline-flex">
          <span className={styles.collapsedIcon}>&#9889;</span>
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-[9px] font-medium px-1 py-0 min-w-[14px]"
            style={{ backgroundColor: connected ? "#52c41a" : "#d9d9d9", color: "#fff" }}
          >
            {events.length}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>&#9889; 运行时事件</span>
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: connected ? "#52c41a" : "#d9d9d9" }}
            />
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <div className={styles.headerRight}>
          <Button
            size="sm"
            variant="ghost"
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
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#bfbfbf]" />
          <Input
            placeholder="搜索事件消息..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className={styles.typeFilters}>
          <Button
            size="sm"
            variant={eventTypeFilter === "all" ? "primary" : "ghost"}
            onClick={() => setEventTypeFilter("all")}
          >
            全部
          </Button>
          {eventTypes.map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            return (
              <span
                key={type}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-opacity"
                style={{
                  backgroundColor: config?.color || "#999",
                  color: "#fff",
                  opacity: eventTypeFilter === type ? 1 : 0.6,
                }}
                onClick={() =>
                  setEventTypeFilter(eventTypeFilter === type ? "all" : type)
                }
              >
                {config?.label || type}
              </span>
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
            />
          </div>
        ) : (
          <div className={styles.eventScrollArea}>
            {filteredEvents.map((evt) => {
              const config = EVENT_TYPE_CONFIG[evt.type] || {
                icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
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
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ backgroundColor: config.color, color: "#fff" }}
                      >
                        {config.label}
                      </span>
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
