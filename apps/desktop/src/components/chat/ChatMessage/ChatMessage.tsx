import React from 'react';
import { User, Bot, AlertTriangle, Wrench } from 'lucide-react';
import styles from './ChatMessage.module.scss';

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
        return <User  />;
      case 'assistant':
        return <Bot  />;
      case 'system':
        return <AlertTriangle  />;
      default:
        return <Bot  />;
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
        return <span><Wrench  /> Tool Call</span>;
      case 'approval':
        return <span>Approval</span>;
      default:
        return <span>Text</span>;
    }
  };

  const renderContent = (): React.ReactNode => {
    if (message.type === 'tool_call') {
      return (
        <details className={styles.toolCallBlock}>
          <summary>{getTypeTag(message.type)}</summary>
          <span >
            {message.content}
          </span>
        </details>
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
          <div className={`${styles.avatar}`}>
            {getRoleIcon(message.role)}
          </div>
          <span >
            {getRoleLabel(message.role)}
          </span>
          <span >
            {message.type}
          </span>
        </div>

        <div className={styles.bodyRow}>
          {renderContent()}
        </div>

        <div className={styles.timestampRow}>
          <span >
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
