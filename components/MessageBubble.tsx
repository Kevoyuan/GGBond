import { Info, RefreshCw, Undo2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { StreamingIndicator } from './StreamingIndicator';
import { ThinkingBlock } from './ThinkingBlock';
import { ExecutionStatusBlock } from './ExecutionStatusBlock';
import { ChatSettings } from './SettingsDialog';
import { StateSnapshotDisplay } from './StateSnapshotDisplay';

// New separated components
import { ContentRenderer } from './message/ContentRenderer';
import { CitationsDisplay } from './message/CitationsDisplay';
import { CopyButton } from './message/CopyButtons';

export interface Message {
  id?: string;
  role: 'user' | 'model';
  content: string;
  error?: boolean;
  stats?: {
    inputTokenCount?: number;
    input_tokens?: number;
    outputTokenCount?: number;
    output_tokens?: number;
    totalTokenCount?: number;
    total_tokens?: number;
    totalCost?: number;
  };
  sessionId?: string;
  parentId?: string | null;
  thought?: string;
  citations?: string[];
  images?: Array<{ dataUrl: string; type: string; name: string }>;
  hooks?: import('./HooksPanel').HookEvent[];
  queued?: boolean;
  tempId?: string;
  agentName?: string;
}

interface MessageBubbleProps {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  settings?: ChatSettings;
  index?: number;
  onUndoTool?: (restoreId: string, sourceMessageId?: string) => Promise<void> | void;
  onUndoMessage?: (messageId: string, messageContent: string) => Promise<void> | void;
  onRetry?: (index: number, mode: 'once' | 'session') => void;
  onCancel?: (index: number) => void;
  hideTodoToolCalls?: boolean;
  isStreaming?: boolean;
  streamingStatus?: string;
}

const GeminiIcon = React.memo(function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4E79F5', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#D36767', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z"
        fill="url(#gemini-gradient)"
      />
    </svg>
  );
});

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isFirst,
  isLast,
  settings,
  index,
  onUndoTool,
  onUndoMessage,
  onRetry,
  onCancel,
  hideTodoToolCalls = false,
  isStreaming = false,
  streamingStatus
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSnapshot = !isUser && message.content.includes('<state_snapshot>');
  const [isUndoingMessage, setIsUndoingMessage] = useState(false);
  const isUndoableUserMessage = Boolean(
    isUser &&
    typeof message.id === 'string' &&
    /^\d+$/.test(message.id) &&
    typeof onUndoMessage === 'function'
  );

  const handleUndoMessage = async () => {
    if (!isUndoableUserMessage || !onUndoMessage || !message.id || isUndoingMessage) {
      return;
    }
    setIsUndoingMessage(true);
    try {
      await onUndoMessage(message.id, message.content);
    } finally {
      setIsUndoingMessage(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn("flex gap-4 w-full group", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 flex items-center justify-center shrink-0 mt-0.5">
          <GeminiIcon className="w-6 h-6" />
        </div>
      )}

      <div className={cn("flex flex-col min-w-0", isUser ? "items-end max-w-[85%] md:max-w-[80%]" : "items-start w-full", isSnapshot && "w-full max-w-3xl")}>
        {isSnapshot ? (
          <StateSnapshotDisplay content={message.content} />
        ) : (
          <div
            id={message.id ? `message-${message.id}` : undefined}
            className={cn(
              "text-sm leading-relaxed max-w-full overflow-x-hidden",
              isUser
                ? message.queued
                  ? "relative bg-blue-600/50 text-blue-100 rounded-2xl px-4 py-2.5 shadow-sm font-medium italic opacity-70"
                  : "relative bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 shadow-sm font-medium"
                : "w-full"
            )}
          >
            {!isUser ? (
              <div className="flex flex-col gap-2">
                {message.hooks && message.hooks.length > 0 && (
                  <ExecutionStatusBlock hooks={message.hooks} defaultExpanded={!message.content && !message.thought} />
                )}
                {message.thought && <ThinkingBlock content={message.thought} />}
                <ContentRenderer
                  content={message.content}
                  sourceMessageId={message.id}
                  onUndoTool={onUndoTool}
                  onRetry={(mode) => onRetry?.(index!, mode)}
                  onCancel={() => onCancel?.(index!)}
                  hideTodoToolCalls={hideTodoToolCalls}
                />
                {message.citations && message.citations.length > 0 && (
                  <CitationsDisplay citations={message.citations} />
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {message.agentName && (
                  <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[11px] font-medium tracking-tight bg-white text-slate-900 shadow-sm border border-slate-200/50 align-middle translate-y-[-0.5px] mr-2">
                    {message.agentName}
                  </span>
                )}
                {message.queued && (
                  <span className="inline-flex items-center gap-1 mr-1.5 opacity-70">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </span>
                )}
                {message.content}
              </div>
            )}

            {isStreaming && (
              <div className="mt-3 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <StreamingIndicator status={streamingStatus} />
              </div>
            )}
          </div>
        )}

        {isUser && !isSnapshot && (
          <div className="flex justify-end mt-1 w-full px-1 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <CopyButton content={message.content} />
            {isUndoableUserMessage && (
              <button
                type="button"
                onClick={() => void handleUndoMessage()}
                disabled={isUndoingMessage}
                className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                title="Undo this message"
              >
                {isUndoingMessage ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Undo2 className="w-3 h-3" />
                )}
                <span>Undo</span>
              </button>
            )}
          </div>
        )}

        {!isUser && message.stats && !isSnapshot && (
          <div className="mt-1 pl-[30px]">
            <TokenUsageDisplay
              stats={message.stats}
              hideModelInfo={settings?.ui?.footer?.hideModelInfo}
              hideContextPercentage={settings?.ui?.footer?.hideContextPercentage}
              showMemoryUsage={settings?.ui?.showMemoryUsage}
            />
          </div>
        )}

        {/* Action Bar */}
        {!isUser && !isSnapshot && !message.error && (
          <div className="flex items-center gap-2 mt-1 pl-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onRetry?.(index!, 'once')}
              className="p-1.5 h-7 text-xs flex items-center gap-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerate response (New Branch)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
            <CopyButton content={message.content} />
          </div>
        )}

        {message.error && (
          <div className="text-destructive text-sm mt-2 flex items-center gap-1.5 bg-destructive/10 px-3 py-2 rounded-md">
            <Info className="w-4 h-4" />
            <span>Error processing request</span>
          </div>
        )}
      </div>

      {isUser && null}
    </motion.div>
  );
});

export const LoadingBubble = React.memo(function LoadingBubble({ status }: { status?: string }) {
  return (
    <div className="flex gap-4 w-full animate-fade-in pl-[54px] mt-2">
      <StreamingIndicator status={status || 'Thinking...'} />
    </div>
  );
});
