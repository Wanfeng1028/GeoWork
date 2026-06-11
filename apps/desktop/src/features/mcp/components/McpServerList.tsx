// GeoWork - MCP Server List
// Displays configured MCP servers with status, tool count, and management controls

import { useState, useEffect } from 'react'
import { Button, Switch, Card, Typography, Input, Modal, Form, Space, Tag, message, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined, ToolOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
import useMcpStore from '../mcpStore'
import type { McpServer } from '../mcpClient'
import styles from './McpServerList.module.scss'

const { Text, Title } = Typography
const { Panel } = Collapse

export function McpServerList() {
  const { servers, isLoading, loadServers, removeServer, toggleServer } = useMcpStore()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [form] = Form.useForm<Omit<McpServer, 'id' | 'tools' | 'enabled'>>({
    name: '',
    command: '',
    args: [],
  })

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const toggleExpand = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverId)) {
        next.delete(serverId)
      } else {
        next.add(serverId)
      }
      return next
    })
  }

  const handleAdd = async (values: Omit<McpServer, 'id' | 'tools' | 'enabled'>) => {
    try {
      await useMcpStore.getState().addServer(values)
      setAddModalOpen(false)
      form.resetFields()
      message.success('MCP server added')
    } catch {
      message.error('Failed to add MCP server')
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeServer(id)
      message.success('Server removed')
    } catch {
      message.error('Failed to remove server')
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleServer(id, enabled)
  }

  const getRiskTag = (toolCount: number) => {
    if (toolCount === 0) return <Tag color="default">0 tools</Tag>
    if (toolCount <= 3) return <Tag color="blue">{toolCount} tool{toolCount > 1 ? 's' : ''}</Tag>
    return <Tag color="cyan">{toolCount} tools</Tag>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title}>
          MCP Servers
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Server
        </Button>
      </div>

      <Collapse
        accordion
        className={styles.collapse}
        activeKey={Array.from(expandedServers)}
        onChange={(keys) => {
          const newKeys = new Set(keys as string[])
          setExpandedServers(newKeys)
        }}
      >
        {servers.length === 0 && !isLoading && (
          <div className={styles.empty}>
            <ToolOutlined className={styles.emptyIcon} />
            <Text type="secondary">No MCP servers configured. Add one to get started.</Text>
          </div>
        )}

        {servers.map((server) => (
          <Panel
            header={
              <div className={styles.serverHeader}>
                <div className={styles.serverInfo}>
                  <span
                    className={`${styles.statusDot} ${server.enabled ? styles.statusConnected : styles.statusDisconnected}`}
                  />
                  <span className={styles.serverName}>{server.name}</span>
                  <span className={styles.serverCommand}>{server.command}</span>
                </div>
                <Space>
                  {getRiskTag(server.tools.length)}
                  <Switch
                    checked={server.enabled}
                    onChange={(checked) => handleToggle(server.id, checked)}
                    size="small"
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(server.id)
                    }}
                  />
                </Space>
              </div>
            }
            key={server.id}
            className={styles.serverPanel}
          >
            <div className={styles.toolsSection}>
              <Title level={5} className={styles.toolsTitle}>
                <ToolOutlined /> Available Tools
              </Title>
              {server.tools.length === 0 ? (
                <Text type="secondary" className={styles.noTools}>No tools available</Text>
              ) : (
                <div className={styles.toolsGrid}>
                  {server.tools.map((tool) => (
                    <div key={tool.id} className={styles.toolItem}>
                      <Text className={styles.toolName}>{tool.name}</Text>
                      {tool.description && (
                        <Text type="secondary" className={styles.toolDesc}>{tool.description}</Text>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {server.env && Object.keys(server.env).length > 0 && (
              <div className={styles.envSection}>
                <Title level={5} className={styles.envTitle}>Environment</Title>
                <div className={styles.envGrid}>
                  {Object.entries(server.env).map(([key, value]) => (
                    <div key={key} className={styles.envItem}>
                      <Text strong className={styles.envKey}>{key}</Text>
                      <Text type="secondary">{value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {server.lastConnected && (
              <Text type="secondary" className={styles.lastConnected}>
                Last connected: {server.lastConnected}
              </Text>
            )}
          </Panel>
        ))}
      </Collapse>

      <Modal
        title="Add MCP Server"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText="Add"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="My MCP Server" />
          </Form.Item>
          <Form.Item label="Command" name="command" rules={[{ required: true, message: 'Command is required' }]}>
            <Input placeholder="node" />
          </Form.Item>
          <Form.Item label="Arguments" name="args">
            <Input placeholder="comma-separated args (e.g. server1.js, --port=3000)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
