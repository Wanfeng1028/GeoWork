/** @format */

// GeoWork GeoComposer - Full implementation
// The main composer for submitting geospatial tasks to the runtime

import { useState, useCallback, useRef } from "react";
import { Button, Select, Space, Tag, Tooltip } from "antd";
import {
  SendOutlined,
  PaperClipOutlined,
  SoundOutlined,
  CloudOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import useShellStore from "../../../../stores/shellStore";
import useTaskStore from "../../../../stores/taskStore";
import useSettingsStore from "../../../../stores/settingsStore";
import styles from "./GeoComposer.module.scss";

const MODES = [
  { value: "work", label: "工作流", icon: "📋" },
  { value: "code", label: "代码", icon: "💻" },
  { value: "paper", label: "论文", icon: "📄" },
  { value: "ppt", label: "PPT", icon: "📊" },
];

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3.5", label: "Claude 3.5" },
  { value: "qwen-max", label: "Qwen Max" },
];

const PERMISSION_LEVELS = [
  { value: "read_only", label: "只读", color: "default" },
  { value: "ask_every_time", label: "每次询问", color: "warning" },
  { value: "limited", label: "受限访问", color: "blue" },
  { value: "full_access", label: "完全访问", color: "red" },
];

const TEMPLATES = [
  { value: "ndvi-analysis", label: "NDVI 分析" },
  { value: "land-cover", label: "土地覆盖分类" },
  { value: "change-detection", label: "变化检测" },
  { value: "custom", label: "自定义" },
];

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

export function GeoComposer() {
  const { activeMode, setActiveMode, activeNavKey } = useShellStore();
  const { createTask } = useTaskStore();
  const { settings } = useSettingsStore();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    settings?.defaultModel || "gpt-4o"
  );
  const [selectedPermission, setSelectedPermission] = useState(
    settings?.defaultPermission || "limited"
  );
  const [selectedTemplate, setSelectedTemplate] = useState("custom");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isSending) return;

    setIsSending(true);
    try {
      const task = await createTask({
        mode: activeMode,
        permissionLevel: selectedPermission,
        model: selectedModel,
        template: selectedTemplate,
        skills: selectedSkills,
        input: input.trim(),
        attachments: attachments.map((a) => ({
          name: a.name,
          path: a.path,
          size: a.size,
          type: a.type,
        })),
      });
      if (task) {
        setInput("");
        setAttachments([]);
        setSelectedSkills([]);
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSending(false);
    }
  }, [
    input,
    isSending,
    activeMode,
    selectedPermission,
    selectedModel,
    selectedTemplate,
    selectedSkills,
    attachments,
    createTask,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const newAttachments: Attachment[] = files.map((file) => ({
      name: file.name,
      path: file.path || file.name,
      size: file.size,
      type: file.type,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        const newAttachments: Attachment[] = Array.from(files).map((file) => ({
          name: file.name,
          path: file.path || file.name,
          size: file.size,
          type: file.type,
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
    []
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const skills = [
    { value: "gee", label: "GEE", description: "Google Earth Engine" },
    { value: "gdal", label: "GDAL", description: "GDAL 地理数据处理" },
    {
      value: "raster-analysis",
      label: "栅格分析",
      description: "栅格数据空间分析",
    },
    {
      value: "vector-analysis",
      label: "矢量分析",
      description: "矢量数据处理",
    },
    { value: "map-design", label: "制图", description: "地图设计与出图" },
    {
      value: "deep-learning",
      label: "深度学习",
      description: "遥感深度学习模型",
    },
  ];

  return (
    <div
      className={styles.composer}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={styles.modeSelector}>
        <Space size="small">
          {MODES.map((mode) => (
            <Tooltip
              key={mode.value}
              title={mode.label}
            >
              <Button
                type={activeMode === mode.value ? "primary" : "text"}
                icon={<span style={{ fontSize: 16 }}>{mode.icon}</span>}
                onClick={() => setActiveMode(mode.value)}
              />
            </Tooltip>
          ))}
        </Space>
      </div>

      <div className={styles.inputSection}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="描述你的地理遥感任务，例如：请帮我运行 NDVI 分析，使用 Sentinel-2 数据生成植被指数地图和报告"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />

        <div className={styles.toolbar}>
          <Space
            size="small"
            wrap
          >
            {/* Template Selector */}
            <Select
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              options={TEMPLATES}
              size="small"
              style={{ width: 140 }}
              prefix={<RocketOutlined style={{ color: "#999" }} />}
            />

            {/* Model Selector */}
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              options={MODELS}
              size="small"
              style={{ width: 120 }}
              prefix={<CloudOutlined style={{ color: "#999" }} />}
            />

            {/* Permission Selector */}
            <Select
              value={selectedPermission}
              onChange={setSelectedPermission}
              size="small"
              style={{ width: 130 }}
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
                    <Tooltip title="根据任务类型选择适当的权限级别">
                      <span style={{ fontSize: 11, color: "#999" }}>
                        权限说明
                      </span>
                    </Tooltip>
                  </div>
                </div>
              )}
            >
              {PERMISSION_LEVELS.map((level) => (
                <Select.Option
                  key={level.value}
                  value={level.value}
                >
                  <Tag color={level.color}>{level.label}</Tag>
                </Select.Option>
              ))}
            </Select>

            {/* Skills Selector */}
            <Select
              mode="multiple"
              value={selectedSkills}
              onChange={setSelectedSkills}
              size="small"
              style={{ width: 180 }}
              placeholder="选择技能"
              options={skills}
            />

            {/* File Attachment */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
            <Button
              size="small"
              icon={<PaperClipOutlined />}
              onClick={handleFileInputClick}
            >
              添加文件
            </Button>

            {/* Voice Input (placeholder for future) */}
            <Tooltip title="语音输入（待实现）">
              <Button
                size="small"
                icon={<SoundOutlined />}
                disabled
              />
            </Tooltip>
          </Space>
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className={styles.attachments}>
            <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>
              附件:
            </span>
            <Space
              size="small"
              wrap
            >
              {attachments.map((att, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    removeAttachment(index);
                  }}
                >
                  {att.name} ({Math.round(att.size / 1024)}KB)
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </div>

      <div className={styles.sendSection}>
        <div className={styles.shortcutHint}>Ctrl+Enter 发送</div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={isSending}
          disabled={!input.trim()}
          className={styles.sendButton}
        >
          发送任务
        </Button>
      </div>
    </div>
  );
}

export default GeoComposer;
