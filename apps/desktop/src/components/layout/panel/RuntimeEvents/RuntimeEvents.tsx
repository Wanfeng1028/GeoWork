/** @format */

// GeoWork RuntimeEvents - Full implementation
// Displays streaming runtime events from the task engine with real-time update

import { useEffect, useState, useCallback } from "react";
import { Play, CheckCircle, XCircle, Loader2, Filter, ChevronRight } from "lucide-react";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import sseClient from "../../../../services/sseClient";
import styles from "./RuntimeEvents.module.scss";

const EVENT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  "task.started": {
    icon: <Play  />,
    color: '',
    label: "任务启动",
  },
  "task.progress": {
    icon: <Loader2  />,
    color: '',
    label: "任务进度",
  },
  "task.completed": {
    icon: <CheckCircle  />,
    color: '',
    label: "任务完成",
  },
  "task.failed": {
    icon: <XCircle  />,
    color: '',
    label: "任务失败",
  },
  "task.cancelled": {
    icon: <XCircle  />,
    color: '',
    label: "任务取消",
  },
  "tool.call.started": {
    icon: <Loader2  />,
    color: '',
    label: "工具调用",
  },
  "tool.call.completed": {
    icon: <CheckCircle  />,
    color: '',
    label: "工具完成",
  },
  "tool.call.failed": {
    icon: <XCircle  />,
    color: '',
    label: "工具失败",
  },
  "permission.request": {
    icon: <Filter  />,
    color: '',
    label: "权限请求",
  },
  "permission.approved": {
    icon: <CheckCircle  />,
    color: '',
    label: "权限通过",
  },
  "permission.denied": {
    icon: <XCircle  />,
    color: '',
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
        <span >
          <span className={styles.collapsedIcon}>&#9889;</span>
          <span className="-top-1 -right-1"
            
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
          <span >
            <span
              
              
            />
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <div className={styles.headerRight}>
          <button
            onClick={handleClear}
          >
            清空
          </button>
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
        <div >
          <Filter  />
          <input
            placeholder="搜索事件消息..."
            onChange={(e) => setFilter(e.target.value)}
            
          />
        </div>
        <div className={styles.typeFilters}>
          <button
            onClick={() => setEventTypeFilter("all")}
          >
            全部
          </button>
          {eventTypes.map((type) => {
            const config = EVENT_TYPE_CONFIG[type];
            return (
              <span
                key={type}
                
                style={{ opacity: eventTypeFilter === type ? 1 : 0.6 }}
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
            <div
              className={styles.emptyContent}
            >
              {events.length === 0 ? "暂无运行时事件" : "无匹配的事件"}
            </div>
          </div>
        ) : (
          <div className={styles.eventScrollArea}>
            {filteredEvents.map((evt) => {
              const config = EVENT_TYPE_CONFIG[evt.type] || {
                icon: <Loader2  />,
                color: '',
                label: evt.type,
              };

              return (
                <div
                  key={evt.id}
                  className={`${styles.eventItem} ${ evt.type?.includes("error") || evt.type?.includes("failed") ? styles.eventError : "" }`}
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
                        
                        style={{ backgroundColor: config.color }}
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
