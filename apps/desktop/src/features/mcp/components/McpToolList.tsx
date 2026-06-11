// GeoWork - MCP Tool List
// Displays and manages tools for a specific MCP server

import { useState } from 'react'
import { Button, Typography, Input, Modal, Collapse, Tag, Space, message, Card } from 'antd'
import { CopyOutlined, PlayCircleOutlined, DownOutlined, UpOutlined, CodeOutlined } from '@ant-design/icons'
import type { McpTool } from '../mcpClient'
import styles from './McpToolList.module.scss'

const { Text } = Typography
const { Panel } = Collapse

export interface McpToolListProps {
  tools: McpTool[]
  serverId: string
  serverName?: string
  onToolCall?: (serverId: string, toolName: string, args: Record<string, unknown>) => void
}

export function McpToolList({ tools, serverId, serverName, onToolCall }: McpToolListProps) {
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null)
  const [testArgs, setTestArgs] = useState('')
  const [testResult, setTestResult] = useState<string>('')

  const handleCopySchema = (tool: McpTool) => {
    navigator.clipboard.writeText(JSON.stringify(tool.inputSchema, null, 2))
    message.success('Schema copied to clipboard')
  }

  const handleTestClick = (tool: McpTool) => {
    setSelectedTool(tool)
    setTestArgs(JSON.stringify(tool.inputSchema, null, 2))
    setTestResult('')
    setTestModalOpen(true)
  }

  const handleRunTest = async () => {
    if (!selectedTool) return
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(testArgs)
    } catch {
      message.error('Invalid JSON in args input')
      return
    }
    setTestResult('Running...')
    try {
      if (onToolCall) {
        onToolCall(serverId, selectedTool.name, args)
        setTestResult(`Tool "${selectedTool.name}" called with provided args.`)
      } else {
        setTestResult(`Would call ${selectedTool.name} with:\n${JSON.stringify(args, null, 2)}`)
      }
    } catch {
      setTestResult('Failed to call tool.')
    }
  }

  if (tools.length === 0) {
    return (
      <div className={styles.empty}>
        <CodeOutlined className={styles.emptyIcon} />
        <Text type="secondary">No tools available for this server</Text>
      </div>
    )
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <Text strong className={styles.title}>
            Tools ({tools.length})
          </Text>
        </div>

        <Collapse accordion className={styles.collapse}>
          {tools.map((tool) => (
            <Panel
              header={
                <div className={styles.toolRow}>
                  <span className={styles.toolName}>{tool.name}</span>
                  <Space size="small">
                    {tool.inputSchema && (
                      <Tag color="blue">
                        <CodeOutlined /> Schema
                      </Tag>
                    )}
                  </Space>
                </div>
              }
              key={tool.id}
              className={styles.toolPanel}
            >
              <div className={styles.toolDetail}>
                {tool.description && (
                  <Text className={styles.toolDescription}>{tool.description}</Text>
                )}

                <div className={styles.toolActions}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopySchema(tool)}
                  >
                    Copy Schema
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleTestClick(tool)}
                  >
                    Test Call
                  </Button>
                </div>

                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <div className={styles.schemaSection}>
                    <Text type="secondary" className={styles.schemaTitle}>Input Schema</Text>
                    <pre className={styles.schemaCode}>
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </Collapse>
      </div>

      <Modal
        title={`Test: ${selectedTool?.name}`}
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        onOk={handleRunTest}
        okText="Run"
        cancelText="Cancel"
        width={600}
      >
        <Text type="secondary" className={styles.testLabel}>
          Enter JSON arguments to pass to the tool:
        </Text>
        <Input.TextArea
          value={testArgs}
          onChange={(e) => setTestArgs(e.target.value)}
          rows={8}
          className={styles.testInput}
          placeholder='{"key": "value"}'
        />
        {testResult && (
          <div className={styles.testResult}>
            <Text type="secondary" className={styles.testResultLabel}>Result:</Text>
            <pre className={styles.testResultCode}>{testResult}</pre>
          </div>
        )}
      </Modal>
    </>
  )
}
