
import React, { useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Bot } from 'lucide-react';
import { GeminiIcon } from './icons/GeminiIcon';
import { MessageBubble, LoadingBubble, Message } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { FileViewer } from './FileViewer';
import { cn } from '@/lib/utils';
import { ChatSettings } from './SettingsDialog';
import { TaskProgressDock, TodoItem } from './TaskProgressDock';

interface ChatContainerProps {
    messages: Message[];
    isLoading: boolean;
    previewFile: { name: string; path: string } | null;
    onClosePreview: () => void;
    settings: ChatSettings;
    onSendMessage: (text: string, options?: { approvalMode?: 'safe' | 'auto'; agentName?: string }) => void;
    onStopMessage?: () => void;
    onUndoTool?: (restoreId: string, sourceMessageId?: string) => Promise<void> | void;
    onUndoMessage?: (messageId: string, messageContent: string) => Promise<void> | void;
    inputPrefillRequest?: { id: number; text: string } | null;
    onRetry: (index: number, mode: 'once' | 'session') => void;
    onCancel: (index: number) => void;
    onModelChange: (model: string) => void;
    currentModel: string;
    sessionStats: { inputTokens: number; outputTokens: number; totalTokens: number; totalCost: number };
    currentContextUsage: number;
    mode: 'code' | 'plan' | 'ask'; // or string
    onModeChange: (mode: 'code' | 'plan' | 'ask') => void;
    approvalMode: 'safe' | 'auto';
    onApprovalModeChange: (mode: 'safe' | 'auto') => void;
    workspacePath?: string;
    showTerminal?: boolean;
    onToggleTerminal?: () => void;
    onInputHeightChange?: (height: number) => void;
    streamingStatus?: string;
}

export const ChatContainer = React.memo(function ChatContainer({
    messages,
    isLoading,
    previewFile,
    onClosePreview,
    settings,
    onSendMessage,
    onStopMessage,
    onUndoTool,
    onUndoMessage,
    inputPrefillRequest,
    onRetry,
    onCancel,
    onModelChange,
    currentModel,
    sessionStats,
    currentContextUsage,
    mode,
    onModeChange,
    approvalMode,
    onApprovalModeChange,
    workspacePath,
    showTerminal,
    onToggleTerminal,
    onInputHeightChange,
    streamingStatus
}: ChatContainerProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lastModelIdx = useMemo(() => {
        return messages.findLastIndex(m => m.role === 'model');
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, isLoading]);

    const normalizeTodoStatus = (value: unknown): TodoItem['status'] => {
        if (value === 'in-progress') return 'in_progress';
        if (value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'cancelled') {
            return value;
        }
        return 'pending';
    };

    const extractTodosFromPayload = (payload: unknown): TodoItem[] | null => {
        if (!payload || typeof payload !== 'object') return null;
        const todosRaw = (payload as { todos?: unknown }).todos;
        if (!Array.isArray(todosRaw)) return null;

        const todos = todosRaw
            .map((todo) => {
                if (!todo || typeof todo !== 'object') return null;
                const description = (todo as { description?: unknown }).description;
                if (typeof description !== 'string' || !description.trim()) return null;
                return {
                    description: description.trim(),
                    status: normalizeTodoStatus((todo as { status?: unknown }).status),
                };
            })
            .filter((todo): todo is TodoItem => todo !== null);

        return todos;
    };

    const parseLatestTodos = (): TodoItem[] | null => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const message = messages[i];
            if (message.role !== 'model' || !message.content.includes('<tool-call')) continue;

            const matches = Array.from(
                message.content.matchAll(/<tool-call[^>]*name="([^"]+)"[^>]*>/g)
            );
            for (let j = matches.length - 1; j >= 0; j -= 1) {
                const fullTag = matches[j][0];
                const toolName = (matches[j][1] || '').toLowerCase();
                if (!toolName.includes('todo')) continue;

                const resultDataMatch = fullTag.match(/result_data="([^"]+)"/);
                if (resultDataMatch?.[1]) {
                    try {
                        const decoded = decodeURIComponent(resultDataMatch[1]);
                        const parsed = JSON.parse(decoded);
                        const todos = extractTodosFromPayload(parsed);
                        if (todos) return todos;
                    } catch {
                        // Fall through to `result` parsing.
                    }
                }

                const resultMatch = fullTag.match(/result="([^"]+)"/);
                if (resultMatch?.[1]) {
                    try {
                        const decoded = decodeURIComponent(resultMatch[1]);
                        const parsed = JSON.parse(decoded);
                        const todos = extractTodosFromPayload(parsed);
                        if (todos) return todos;
                    } catch {
                        // Ignore plain text results.
                    }
                }
            }
        }
        return null;
    };

    const latestTodos = parseLatestTodos();

    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {previewFile ? (
                <FileViewer
                    filePath={previewFile.path}
                    fileName={previewFile.name}
                    onClose={onClosePreview}
                    className="flex-1"
                />
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto scroll-smooth relative" ref={scrollContainerRef}>
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', opacity: 1 }}>
                                <div className="text-center space-y-4 max-w-lg mx-auto">
                                    <div className="mb-6 flex justify-center">
                                        <GeminiIcon className="w-16 h-16" />
                                    </div>
                                    <h2 className="text-2xl font-semibold tracking-tight">
                                        How can I help you today?
                                    </h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        I can help you write code, debug issues, or answer questions about your project.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto w-full pb-8 pt-6 px-4 flex flex-col gap-6">
                                {messages.map((msg, idx) => {
                                    const prev = messages[idx - 1];
                                    const next = messages[idx + 1];
                                    const isFirstInSequence = !prev || prev.role === 'user';
                                    const isLastInSequence = !next || next.role === 'user';
                                    const isStreaming = isLoading && msg.role === 'model' && !!streamingStatus && idx === lastModelIdx;

                                    return (
                                        <div key={msg.id || idx} data-message-index={idx} className={cn("flex flex-col gap-2", msg.role === 'user' && "items-end")}>
                                            {/* Show images before user message - right aligned */}
                                            {msg.role === 'user' && msg.images && msg.images.length > 0 && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {msg.images.map((img, imgIdx) => (
                                                        <Image
                                                            key={imgIdx}
                                                            src={img.dataUrl}
                                                            alt={img.name}
                                                            width={200}
                                                            height={200}
                                                            className="max-w-[200px] max-h-[200px] object-contain rounded-lg border"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            <MessageBubble
                                                message={msg}
                                                isFirst={isFirstInSequence}
                                                isLast={isLastInSequence}
                                                settings={settings}
                                                index={idx}
                                                onUndoTool={onUndoTool}
                                                onUndoMessage={onUndoMessage}
                                                onRetry={onRetry}
                                                onCancel={onCancel}
                                                isStreaming={isStreaming}
                                                streamingStatus={streamingStatus}
                                            />
                                        </div>
                                    );
                                })}
                                {isLoading && (lastModelIdx === -1 || !streamingStatus) && (
                                    <LoadingBubble status={streamingStatus || "Thinking..."} />
                                )}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>
                        )}
                    </div>

                    {latestTodos && latestTodos.length > 0 && <TaskProgressDock todos={latestTodos} />}
                    <ChatInput
                        onSend={onSendMessage}
                        onStop={onStopMessage}
                        isLoading={isLoading}
                        currentModel={currentModel}
                        onModelChange={onModelChange}
                        sessionStats={sessionStats}
                        currentContextUsage={currentContextUsage}
                        mode={mode}
                        onModeChange={onModeChange}
                        approvalMode={approvalMode}
                        onApprovalModeChange={onApprovalModeChange}
                        workspacePath={workspacePath}
                        showTerminal={showTerminal}
                        onToggleTerminal={onToggleTerminal}
                        onHeightChange={onInputHeightChange}
                        prefillRequest={inputPrefillRequest}
                        compressionThreshold={settings.modelSettings?.compressionThreshold ?? 0.5}
                    />
                </>
            )}
        </div>
    );
});
