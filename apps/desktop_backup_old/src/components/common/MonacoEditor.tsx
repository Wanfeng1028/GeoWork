import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { OnChange, OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import styles from './MonacoEditor.module.scss'

export type Language = 'python' | 'javascript' | 'json' | 'markdown'

export interface MonacoEditorProps {
  value?: string
  language?: Language
  filename?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onFileChange?: (filename: string) => void
}

const languageMap: Record<Language, string> = {
  python: 'python',
  javascript: 'javascript',
  json: 'json',
  markdown: 'markdown'
}

const defaultContent: Record<Language, string> = {
  python: `# GeoWork GEE Script\nimport ee\n\n# 初始化 Earth Engine\n# ee.Initialize()\n\n# 加载 Sentinel-2 影像\ns2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \\\n    .filterDate('2024-01-01', '2024-12-31') \\\n    .filterBounds(ee.Geometry.Point(116.4, 39.9)) \\\n    .filterCloudCover(10)\n\n# 计算 NDVI\ndef add_ndvi(image):\n    ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')\n    return image.addBands(ndvi)\n\ns2_ndvi = s2.map(add_ndvi)\nprint(f"Loaded {s2_ndvi.size()} images")`,
  javascript: `// GeoWork GEE Script (JavaScript API)\n// 计算 NDVI 并导出结果\n\nvar geometry = ee.Geometry.Point([116.4, 39.9]);\n\nvar s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')\n    .filterDate('2024-01-01', '2024-12-31')\n    .filterBounds(geometry)\n    .filterCloudCover(10);\n\nvar ndvi = s2.select(['B8', 'B4'])\n    .map(function(image) {\n        return image.normalizedDifference(['B8', 'B4']).rename('NDVI');\n    });\n\nprint('NDVI Collection size:', ndvi.size());`,
  json: `{
  "project": "GeoWork NDVI Experiment",
  "mode": "Analysis",
  "parameters": {
    "region": "Beijing",
    "coordinates": [116.4, 39.9],
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "cloudCoverThreshold": 10,
    "bands": ["B8", "B4", "B3", "B2"]
  }
}`,
  markdown: `# NDVI 实验报告\n\n## 概述\n\n本报告基于 Sentinel-2 数据，使用 Google Earth Engine 计算研究区域的 NDVI。\n\n## 数据源\n\n- **传感器**: Sentinel-2 MSI\n- **产品**: Surface Reflectance (SR)\n- **时间范围**: 2024-01-01 至 2024-12-31\n\n## 方法\n\nNDVI = (NIR - Red) / (NIR + Red)\n\n## 结果\n\nNDVI 值范围: -1 至 1，正值表示植被覆盖。\n\n## 结论\n\n研究区域植被覆盖良好，NDVI 均值约为 0.65。`
}

export function MonacoEditor({
  value,
  language = 'python',
  filename = 'script.py',
  readOnly = false,
  onChange,
  onFileChange
}: MonacoEditorProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [content, setContent] = useState(value ?? defaultContent[language])
  const [fontSize, setFontSize] = useState(14)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: 'on',
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection'
    })
  }, [])

  const handleChange: OnChange = useCallback((newValue) => {
    if (newValue !== undefined) {
      setContent(newValue)
      onChange?.(newValue)
    }
  }, [onChange])

  useEffect(() => {
    if (value !== undefined && value !== content) {
      setContent(value)
    }
  }, [value])

  const handleSave = useCallback(() => {
    if (editorRef.current) {
      // Monaco editor doesn't have a save method - trigger save command
      editorRef.current.trigger('save', 'editor.action.save', null)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.min(prev + 2, 24))
  }, [])

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => Math.max(prev - 2, 10))
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.filename}>{filename}</span>
        <span className={styles.toolbarActions}>
          <button
            className={styles.toolbarBtn}
            onClick={increaseFontSize}
            title="放大字体"
            aria-label="放大字体"
          >
            A+
          </button>
          <button
            className={styles.toolbarBtn}
            onClick={decreaseFontSize}
            title="缩小字体"
            aria-label="缩小字体"
          >
            A-
          </button>
          <button
            className={styles.toolbarBtn}
            onClick={toggleTheme}
            title={`切换到${theme === 'light' ? '暗色' : '亮色'}主题`}
            aria-label="切换主题"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {!readOnly && (
            <button
              className={`${styles.toolbarBtn} ${styles.saveBtn}`}
              onClick={handleSave}
              title="保存 (Ctrl+S)"
              aria-label="保存"
            >
              💾 保存
            </button>
          )}
        </span>
      </div>
      <div className={styles.editorWrap}>
        <Editor
          height="100%"
          language={languageMap[language]}
          value={content}
          theme={theme}
          onChange={handleChange}
          onMount={handleMount}
          options={{
            readOnly,
            fontSize,
            tabSize: 2,
            insertSpaces: true,
            bracketPairColorization: { enabled: true },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            lineNumbersMinChars: 3
          }}
        />
      </div>
    </div>
  )
}
