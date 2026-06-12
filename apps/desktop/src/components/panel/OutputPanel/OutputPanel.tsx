/** @format */

// GeoWork OutputPanel - Full implementation
// General output panel showing build output, compilation results, and command output

import { useState } from "react";
import { Play, Square, Trash2, Download } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select";
import styles from "./OutputPanel.module.scss";

type OutputChannel =
  | "build"
  | "debug"
  | "terminal"
  | "extension"
  | "geo-worker";

interface OutputLine {
  id: string;
  timestamp: string;
  text: string;
  type: "info" | "warn" | "error" | "success";
}

// Sample output data
const SAMPLE_OUTPUT: Record<OutputChannel, OutputLine[]> = {
  build: [
    {
      id: "b1",
      timestamp: "10:00:01",
      text: "[INFO] Starting GeoWork build...",
      type: "info",
    },
    {
      id: "b2",
      timestamp: "10:00:02",
      text: "[INFO] Compiling TypeScript...",
      type: "info",
    },
    {
      id: "b3",
      timestamp: "10:00:05",
      text: "[WARN] Unused import in taskStore.ts",
      type: "warn",
    },
    {
      id: "b4",
      timestamp: "10:00:08",
      text: "[SUCCESS] Build completed in 7.2s",
      type: "success",
    },
  ],
  debug: [
    {
      id: "d1",
      timestamp: "10:01:00",
      text: "[DEBUG] Task created: task-abc123",
      type: "info",
    },
    {
      id: "d2",
      timestamp: "10:01:01",
      text: "[DEBUG] SSE connection established",
      type: "info",
    },
    {
      id: "d3",
      timestamp: "10:01:02",
      text: "[DEBUG] Tool call started: ndvi_analysis",
      type: "info",
    },
  ],
  terminal: [
    {
      id: "t1",
      timestamp: "10:02:00",
      text: "user@geowork:~$ python analyze.py",
      type: "info",
    },
    {
      id: "t2",
      timestamp: "10:02:03",
      text: "NDVI analysis completed. Output: /workspace/output/ndvi.tif",
      type: "success",
    },
  ],
  extension: [
    {
      id: "e1",
      timestamp: "10:00:00",
      text: "[INFO] Extensions loaded: 6 plugins",
      type: "info",
    },
    {
      id: "e2",
      timestamp: "10:00:01",
      text: "[INFO] GeoWorker plugin v0.2.1 initialized",
      type: "info",
    },
  ],
  "geo-worker": [
    {
      id: "g1",
      timestamp: "10:03:00",
      text: "[INFO] GeoPython worker started on port 8765",
      type: "info",
    },
    {
      id: "g2",
      timestamp: "10:03:01",
      text: "[INFO] GDAL version: 3.6.4",
      type: "info",
    },
    {
      id: "g3",
      timestamp: "10:03:02",
      text: "[INFO] GEE authentication: connected",
      type: "success",
    },
  ],
};

export function OutputPanel() {
  const [activeChannel, setActiveChannel] = useState<OutputChannel>("build");
  const [output, setOutput] = useState<OutputLine[]>(SAMPLE_OUTPUT.build);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const channels: { value: OutputChannel; label: string }[] = [
    { value: "build", label: "Build" },
    { value: "debug", label: "Debug" },
    { value: "terminal", label: "Terminal" },
    { value: "extension", label: "Extension" },
    { value: "geo-worker", label: "GeoWorker" },
  ];

  const handleChannelChange = (value: OutputChannel) => {
    setActiveChannel(value);
    setOutput(SAMPLE_OUTPUT[value] || []);
  };

  const handleClear = () => {
    setOutput([]);
  };

  const handleDownload = () => {
    const content = output
      .map((line) => `[${line.timestamp}] ${line.text}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getColor = (type: OutputLine["type"]) => {
    switch (type) {
      case "error":
        return "#f5222d";
      case "warn":
        return "#faad14";
      case "success":
        return "#52c41a";
      default:
        return "#8c8c8c";
    }
  };

  const getPrefix = (type: OutputLine["type"]) => {
    switch (type) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "success":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Select
            value={activeChannel}
            onValueChange={(value) => handleChannelChange(value as OutputChannel)}
          >
            <SelectTrigger className={styles.channelSelect}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((ch) => (
                <SelectItem key={ch.value} value={ch.value}>
                  {ch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={styles.headerRight}>
          <Button
            size="sm"
            variant={isAutoScroll ? "primary" : "ghost"}
            onClick={() => setIsAutoScroll(!isAutoScroll)}
          >
            自动滚动
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            清除
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            导出
          </Button>
        </div>
      </div>

      <div
        className={styles.outputArea}
        ref={(el) => {
          if (el && isAutoScroll) {
            el.scrollTop = el.scrollHeight;
          }
        }}
      >
        {output.length === 0 ? (
          <div className={styles.emptyOutput}>
            <span style={{ fontSize: 12, color: "#bfbfbf" }}>暂无输出</span>
          </div>
        ) : (
          <div className={styles.outputLines}>
            {output.map((line) => (
              <div
                key={line.id}
                className={styles.outputLine}
              >
                <span
                  className={styles.linePrefix}
                  style={{ color: getColor(line.type) }}
                >
                  {getPrefix(line.type)}
                </span>
                <span className={styles.lineTime}>{line.timestamp}</span>
                <span className={styles.lineText}>{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
