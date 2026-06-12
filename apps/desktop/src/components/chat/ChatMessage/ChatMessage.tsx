import React from 'react';
import { User, Bot, AlertTriangle, Wrench } from 'lucide-react';
import { Badge } from '../../ui/badge';
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
        return <User className="h-3.5 w-3.5" />;
      case 'assistant':
        return <Bot className="h-3.5 w-3.5" />;
      case 'system':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <Bot className="h-3.5 w-3.5" />;
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
        return <Badge variant="info"><Wrench className="h-3 w-3" /> Tool Call</Badge>;
      case 'approval':
        return <Badge variant="warning">Approval</Badge>;
      default:
        return <Badge variant="accent">Text</Badge>;
    }
  };

  const renderContent = (): React.ReactNode => {
    if (message.type === 'tool_call') {
      return (
        <details className={styles.toolCallBlock}>
          <summary>{getTypeTag(message.type)}</summary>
          <span className="text-[12px] text-[var(--gw-text-tertiary)]">
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
          <div className={`${styles.avatar} flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gw-bg-active)]`}>
            {getRoleIcon(message.role)}
          </div>
          <span className="text-[12px] font-semibold text-[var(--gw-text-primary)]">
            {getRoleLabel(message.role)}
          </span>
          <Badge variant="default" className="ml-auto">
            {message.type}
          </Badge>
        </div>

        <div className={styles.bodyRow}>
          {renderContent()}
        </div>

        <div className={styles.timestampRow}>
          <span className="text-[11px] text-[var(--gw-text-tertiary)]">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
