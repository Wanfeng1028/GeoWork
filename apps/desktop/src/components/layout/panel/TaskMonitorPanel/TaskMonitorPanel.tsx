/** @format */

// GeoWork TaskMonitorPanel - Full implementation
// Monitors running tasks with streaming status, progress, steps, and error display

import { useState, useEffect } from "react";
import { Progress, Tag, Button, Collapse, Timeline, Spin, Alert } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import useTaskStore from "../../../../stores/taskStore";
import useChatStore from "../../../../stores/chatStore";
import styles from "./TaskMonitorPanel.module.scss";

const { Panel } = Collapse;

const STATUS_CONFIG = {
  pending: { color: "#faad14", icon: <PauseCircleOutlined />, label: "等待中" },
  running: { color: "#1890ff", icon: <PlayCircleOutlined />, label: "运行中" },
  waiting_approval: {
    color: "#fa8c16",
    icon: <ThunderboltOutlined />,
    label: "等待审批",
  },
  completed: {
    color: "#52c41a",
    icon: <CheckCircleOutlined />,
    label: "已完成",
  },
  failed: { color: "#f5222d", icon: <CloseCircleOutlined />, label: "失败" },
  recovered: { color: "#13c2c2", icon: <ReloadOutlined />, label: "已恢复" },
};

function ReloadOutlined() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 1024 1024"
      fill="currentColor"
    >
      <path d="M831.872 340.864A448 448 0 1 0 850.88 512h-63.488a384 384 0 1 1 112-171.136h-67.52z"></path>
      <path d="M850.88 512A448 448 0 0 0 512 173.248V96A544 544 0 1 1 928 512h-77.12z"></path>
    </svg>
  );
}

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
          <ThunderboltOutlined /> 任务监控
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
              <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
            </div>

            {currentTaskStatus === "running" && (
              <div className={styles.progressSection}>
                <Progress
                  percent={progressPercent}
                  status={totalSteps === 0 ? "active" : "normal"}
                  size="small"
                />
                <span className={styles.progressText}>
                  {completedSteps}/{totalSteps} 步骤完成
                </span>
              </div>
            )}

            {/* Task Steps */}
            {currentTask?.plan && currentTask.plan.length > 0 && (
              <Collapse
                defaultActiveKey={[]}
                bordered={false}
                size="small"
                className={styles.stepsCollapse}
              >
                {currentTask.plan.map((step: any, index: number) => (
                  <Panel
                    header={
                      <span className={styles.stepItem}>
                        <span className={styles.stepIndex}>{index + 1}</span>
                        <span className={styles.stepTitle}>{step.title}</span>
                        <span className={styles.stepStatus}>
                          {step.toolName || ""}
                        </span>
                      </span>
                    }
                    key={step.id}
                  >
                    {step.status === "running" && (
                      <Spin
                        size="small"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                    {step.status === "completed" && (
                      <span className={styles.stepCompleted}>✓ 已完成</span>
                    )}
                    {step.status === "failed" && (
                      <span className={styles.stepFailed}>✗ 失败</span>
                    )}
                    {step.startedAt && (
                      <span className={styles.stepTime}>
                        开始: {new Date(step.startedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </Panel>
                ))}
              </Collapse>
            )}

            {/* Error Display */}
            {error && (
              <Alert
                message="任务错误"
                description={error}
                type="error"
                showIcon
                className={styles.errorAlert}
              />
            )}

            {/* Actions */}
            <div className={styles.actions}>
              {currentTaskStatus === "running" && (
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={handleCancel}
                >
                  取消任务
                </Button>
              )}
              {currentTaskStatus === "failed" && (
                <Button
                  size="small"
                  type="primary"
                  icon={<ReloadOutlined />}
                >
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
          <Timeline
            className={styles.eventTimeline}
            items={recentEvents.map((evt) => ({
              dot: evt.type?.includes("error") ? (
                <CloseCircleOutlined style={{ color: "#f5222d" }} />
              ) : (
                <LoadingOutlined />
              ),
              color: evt.type?.includes("error") ? "red" : "blue",
              children: (
                <div>
                  <div className={styles.eventMessage}>{evt.message}</div>
                  <div className={styles.eventTime}>
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      )}
    </div>
  );
}

export default TaskMonitorPanel;
