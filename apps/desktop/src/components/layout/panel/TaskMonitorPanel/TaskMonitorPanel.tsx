/** @format */

// GeoWork TaskMonitorPanel - Full implementation
// Monitors running tasks with streaming status, progress, steps, and error display

import { useState, useEffect } from "react";
import { Play, Pause, Square, CheckCircle, XCircle, Loader2, Zap, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "../../../ui/button";
import { Badge } from "../../../ui/badge";
import { Spinner } from "../../../ui/spinner";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import styles from "./TaskMonitorPanel.module.scss";

const STATUS_CONFIG = {
  pending: { color: "#faad14", icon: <Pause className="h-3.5 w-3.5" />, label: "等待中" },
  running: { color: "#1890ff", icon: <Play className="h-3.5 w-3.5" />, label: "运行中" },
  waiting_approval: {
    color: "#fa8c16",
    icon: <Zap className="h-3.5 w-3.5" />,
    label: "等待审批",
  },
  completed: {
    color: "#52c41a",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    label: "已完成",
  },
  failed: { color: "#f5222d", icon: <XCircle className="h-3.5 w-3.5" />, label: "失败" },
  recovered: { color: "#13c2c2", icon: <RefreshCw className="h-3.5 w-3.5" />, label: "已恢复" },
};

export function TaskMonitorPanel() {
  const { tasks, currentTask, events, isLoading, error } = useTaskStore();
  const [collapsed, setCollapsed] = useState(false);

  const currentTaskStatus = currentTask?.status || null;
  const statusConfig =
    STATUS_CONFIG[currentTaskStatus as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.pending;

  const completedSteps =
    currentTask?.plan?.filter((s: any) => s.status === "completed").length || 0;
  const totalSteps = currentTask?.plan?.length || 0;
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const recentEvents = events.slice(-10).reverse();

  const handleCancel = () => {
    if (currentTask) {
      useTaskStore.getState().cancelTask(currentTask.id);
    }
  };

  if (collapsed) {
    return (
      <button
        className={styles.collapsedBtn}
        onClick={() => setCollapsed(false)}
      >
        <span
          className={styles.statusDot}
          style={{ background: statusConfig.color }}
        >
          {statusConfig.icon}
        </span>
        <span className={styles.collapsedLabel}>任务监控</span>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Zap className="h-4 w-4" /> 任务监控
        </span>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(true)}
        >
          −
        </button>
      </div>

      {/* Current Task Status */}
      <div className={styles.taskStatus}>
        {currentTask ? (
          <>
            <div className={styles.taskHeader}>
              <span className={styles.taskTitle}>
                <span
                  className={styles.statusIcon}
                  style={{ color: statusConfig.color }}
                >
                  {statusConfig.icon}
                </span>
                {currentTask.id}
              </span>
              <Badge
                variant={currentTaskStatus === "completed" ? "success" : currentTaskStatus === "failed" ? "danger" : "warning"}
              >
                {statusConfig.label}
              </Badge>
            </div>

            {currentTaskStatus === "running" && (
              <div className={styles.progressSection}>
                <div className="w-full h-1.5 rounded-full bg-[var(--gw-bg-active)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--gw-accent)] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className={styles.progressText}>
                  {completedSteps}/{totalSteps} 步骤完成
                </span>
              </div>
            )}

            {/* Task Steps */}
            {currentTask?.plan && currentTask.plan.length > 0 && (
              <div className={styles.stepsCollapse}>
                {currentTask.plan.map((step: any, index: number) => (
                  <details
                    key={step.id}
                    className="border-b border-[var(--gw-border-soft)]"
                  >
                    <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--gw-bg-hover)]">
                      <span className={styles.stepItem}>
                        <span className={styles.stepIndex}>{index + 1}</span>
                        <span className={styles.stepTitle}>{step.title}</span>
                        <span className={styles.stepStatus}>
                          {step.toolName || ""}
                        </span>
                      </span>
                    </summary>
                    <div className="px-3 py-2">
                      {step.status === "running" && (
                        <Spinner size="sm" className="ml-2" />
                      )}
                      {step.status === "completed" && (
                        <span className={styles.stepCompleted}>&#10003; 已完成</span>
                      )}
                      {step.status === "failed" && (
                        <span className={styles.stepFailed}>&#10007; 失败</span>
                      )}
                      {step.startedAt && (
                        <span className={styles.stepTime}>
                          开始: {new Date(step.startedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-[var(--gw-radius-sm)] bg-[var(--gw-danger-soft)] border border-[var(--gw-danger)]/20 text-[var(--gw-danger)] text-[12px]">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">任务错误</div>
                  <div className="mt-1 opacity-80">{error}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {currentTaskStatus === "running" && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleCancel}
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  取消任务
                </Button>
              )}
              {currentTaskStatus === "failed" && (
                <Button
                  size="sm"
                  variant="primary"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  恢复任务
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className={styles.noTask}>
            <span style={{ fontSize: 12, color: "#bfbfbf" }}>
              暂无运行中的任务
            </span>
          </div>
        )}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className={styles.eventsSection}>
          <span className={styles.eventsTitle}>最近事件</span>
          <div className={styles.eventTimeline}>
            {recentEvents.map((evt, index) => (
              <div key={evt.id || index} className="flex gap-3 pb-3">
                <div className="flex flex-col items-center">
                  {evt.type?.includes("error") ? (
                    <XCircle className="h-4 w-4 text-[#f5222d]" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-[#1890ff] animate-spin" />
                  )}
                  {index < recentEvents.length - 1 && (
                    <div className="w-px flex-1 bg-[var(--gw-border-soft)] mt-1" />
                  )}
                </div>
                <div>
                  <div className={styles.eventMessage}>{evt.message}</div>
                  <div className={styles.eventTime}>
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskMonitorPanel;
