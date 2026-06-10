import React from 'react';
import { Tag, Avatar, Typography, Collapse } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  WarningOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import styles from './ChatMessage.module.scss';

const { Text } = Typography;

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'tool_call' | 'approval';
  content: string;
  timestamp: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const formatTimestamp = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleIcon = (role: string): React.ReactNode => {
    switch (role) {
      case 'user':
        return <UserOutlined />;
      case 'assistant':
        return <RobotOutlined />;
      case 'system':
        return <WarningOutlined />;
      default:
        return <RobotOutlined />;
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'GeoWork';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  const getTypeTag = (type: string): React.ReactNode => {
    switch (type) {
      case 'tool_call':
        return <Tag color="geekblue"><ToolOutlined /> Tool Call</Tag>;
      case 'approval':
        return <Tag color="orange">Approval</Tag>;
      default:
        return <Tag color="cyan">Text</Tag>;
    }
  };

  const renderContent = (): React.ReactNode => {
    if (message.type === 'tool_call') {
      return (
        <Collapse
          size="small"
          defaultActiveKey={[]}
          className={styles.toolCallBlock}
          items={[
            {
              key: '1',
              label: getTypeTag(message.type),
              children: (
                <Text type="secondary" style={{ fontSize: '0.85em' }}>
                  {message.content}
                </Text>
              ),
            },
          ]}
        />
      );
    }

    return (
      <div className={styles.messageContent}>
        {message.content}
      </div>
    );
  };

  return (
    <div
      className={`${styles.messageContainer} ${styles[`${message.role}Message`]}`}
    >
      <div className={styles.messageWrapper}>
        <div className={styles.messageHeader}>
          <Avatar
            size="small"
            icon={getRoleIcon(message.role)}
            className={styles.avatar}
          />
          <Text strong style={{ fontSize: '0.85em' }}>
            {getRoleLabel(message.role)}
          </Text>
          <Tag color="default" style={{ marginLeft: 'auto' }}>
            {message.type}
          </Tag>
        </div>

        <div className={styles.bodyRow}>
          {renderContent()}
        </div>

        <div className={styles.timestampRow}>
          <Text type="secondary" style={{ fontSize: '0.75em' }}>
            {formatTimestamp(message.timestamp)}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
