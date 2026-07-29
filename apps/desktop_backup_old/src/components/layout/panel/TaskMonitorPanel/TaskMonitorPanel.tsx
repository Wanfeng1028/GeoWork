/** @format */

// GeoWork TaskMonitorPanel - Full implementation
// Monitors running tasks with streaming status, progress, steps, and error display

import { useState, useEffect } from "react";
import { Play, Pause, Square, CheckCircle, XCircle, Loader2, Zap, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import styles from "./TaskMonitorPanel.module.scss";

const STATUS_CONFIG = {
  pending: { color: '', icon: <Pause  />, label: "等待中" },
  running: { color: '', icon: <Play  />, label: "运行中" },
  waiting_approval: {
    color: '',
    icon: <Zap  />,
    label: "等待审批",
  },
  completed: {
    color: '',
    icon: <CheckCircle  />,
    label: "已完成",
  },
  failed: { color: '', icon: <XCircle  />, label: "失败" },
  recovered: { color: '', icon: <RefreshCw  />, label: "已恢复" },
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
          <Zap  /> 任务监控
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
              <span
              >
                {statusConfig.label}
              </span>
            </div>

            {currentTaskStatus === "running" && (
              <div className={styles.progressSection}>
                <div >
                  <div
                    
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
                    
                  >
                    <summary >
                      <span className={styles.stepItem}>
                        <span className={styles.stepIndex}>{index + 1}</span>
                        <span className={styles.stepTitle}>{step.title}</span>
                        <span className={styles.stepStatus}>
                          {step.toolName || ""}
                        </span>
                      </span>
                    </summary>
                    <div >
                      {step.status === "running" && (
                        <div  />
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
              <div >
                <XCircle  />
                <div>
                  <div >任务错误</div>
                  <div >{error}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {currentTaskStatus === "running" && (
                <button
                  onClick={handleCancel}
                >
                  <Square  />
                  取消任务
                </button>
              )}
              {currentTaskStatus === "failed" && (
                <button
                >
                  <RefreshCw  />
                  恢复任务
                </button>
              )}
            </div>
          </>
        ) : (
          <div className={styles.noTask}>
            <span style={{ fontSize: 12 }}>
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
              <div key={evt.id || index} >
                <div >
                  {evt.type?.includes("error") ? (
                    <XCircle  />
                  ) : (
                    <Loader2  />
                  )}
                  {index < recentEvents.length - 1 && (
                    <div  />
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
