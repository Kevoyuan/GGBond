'use client';

import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Check,
  Circle,
  Clock,
  Code2,
  FileCode2,
  FolderTree,
  GitBranch,
  LayoutList,
  Loader2,
  TerminalSquare,
  X,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import { Message } from '@/components/chat/MessageBubble';
import { ConversationGraph, GraphMessage } from '@/components/insights/ConversationGraph';
import { BranchInsights } from '@/components/insights/BranchInsights';
import { MessageTimeline } from '@/components/chat/MessageTimeline';
import { ArtifactPreview } from '@/components/file/ArtifactPreview';
import { FileTree } from '@/components/panels/FileTree';
import { PlanBlock } from '@/components/cognitive/PlanBlock';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import { ModulesPane } from '@/components/panels/ModulesPane';
import { UsagePane } from '@/components/panels/UsagePane';
import { cn } from '@/lib/utils';
import { ResizeHandle, useResize } from '@/components/ui/ResizeHandle';
import { PanelSwitcher } from '@/components/session/PanelSwitcher';
import {
  transformToGraphMessage,
  computeBranchInsights,
  getBranchJumpMessages,
  BranchInsightsData,
} from '@/lib/side-panel-utils';

export type WorkbenchPanelType = 'graph' | 'timeline' | 'artifact' | 'tasks' | 'plan' | 'terminal' | 'files' | 'modules' | 'usage' | null;

interface SidePanelProps {
  sidePanelType: WorkbenchPanelType;
  sidePanelWidth: number;
  setSidePanelWidth: (width: number) => void;
  messages: Message[];
  messagesMap: Map<string, Message>;
  headId: string | null;
  setHeadId: (id: string | null) => void;
  showInfoToast: (message: string) => void;
  artifactPath?: string | null;
  onCloseArtifact?: () => void;
  workspacePath?: string;
  sessionId?: string | null;
  onSessionRunStateChange?: (sessionId: string, delta: number) => void;
  onOpenArtifact?: (path: string) => void;
  onOpenFile?: (file: { name: string; path: string }) => void;
  onSelectPanel?: (type: NonNullable<WorkbenchPanelType>) => void;
  onClosePanel?: () => void;
}

type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface TodoItem {
  description: string;
  status: TodoStatus;
}

function normalizeTodoStatus(value: unknown): TodoStatus {
  if (value === 'in-progress') return 'in_progress';
  if (value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'cancelled') {
    return value;
  }
  return 'pending';
}

function extractTodosFromPayload(payload: unknown): TodoItem[] | null {
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
}

function getLatestTodos(messages: Message[]): TodoItem[] | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'model' || !message.content.includes('<tool-call')) continue;

    const matches = Array.from(message.content.matchAll(/<tool-call[^>]*name="([^"]+)"[^>]*>/g));
    for (let j = matches.length - 1; j >= 0; j -= 1) {
      const fullTag = matches[j][0];
      const toolName = (matches[j][1] || '').toLowerCase();
      if (!toolName.includes('todo')) continue;

      for (const attr of ['result_data', 'result']) {
        const resultMatch = fullTag.match(new RegExp(`${attr}="([^"]+)"`));
        if (!resultMatch?.[1]) continue;
        try {
          const parsed = JSON.parse(decodeURIComponent(resultMatch[1]));
          const todos = extractTodosFromPayload(parsed);
          if (todos) return todos;
        } catch {
          // Ignore malformed tool payloads and continue scanning older entries.
        }
      }
    }
  }
  return null;
}

function getLatestPlan(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'model') continue;
    const index = message.content.lastIndexOf('# Updated Plan');
    if (index >= 0) {
      return message.content.slice(index).replace(/<tool-call[\s\S]*$/g, '').trim();
    }
  }
  return '';
}

function EmptyPane({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/40 bg-gradient-to-br from-muted/50 to-muted/5 text-muted-foreground shadow-sm">
        <Icon className="h-6 w-6 opacity-60" />
      </div>
      <div className="text-sm font-bold text-foreground uppercase tracking-tight">{title}</div>
      <div className="mt-2 max-w-[32ch] text-xs leading-relaxed text-muted-foreground/70">{body}</div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-all border border-primary/20"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function TasksPane({ todos }: { todos: TodoItem[] | null }) {
  const completed = todos?.filter((todo) => todo.status === 'completed').length ?? 0;
  const total = todos?.length ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (!todos?.length) {
    return <EmptyPane icon={LayoutList} title="No task list yet" body="When the agent writes todos, they will collect here instead of crowding the chat." />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border/50 px-5 py-3.5 bg-gradient-to-b from-transparent to-muted/[0.02]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">Task Progress</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{completed}/{total} complete</div>
          </div>
          <div className="flex h-7 w-14 items-center justify-center rounded-md border border-border/50 bg-muted/30 font-mono text-xs tabular-nums text-foreground">{percent}%</div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/70">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)]"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {todos.map((todo, index) => {
            const done = todo.status === 'completed';
            const active = todo.status === 'in_progress';
            const cancelled = todo.status === 'cancelled';
            return (
              <motion.div
                key={`${todo.description}-${index}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, type: "spring", stiffness: 200, damping: 20 }}
                className="group flex min-h-9 items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-all hover:bg-muted/60 hover:shadow-sm"
              >
                <div className="mt-0.5 shrink-0">
                  {done && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </div>
                  )}
                  {active && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                    </div>
                  )}
                  {cancelled && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted">
                      <X className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                  {!done && !active && !cancelled && (
                    <div className="flex h-4 w-4 items-center justify-center">
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                    </div>
                  )}
                </div>
                <div className={cn(
                  "min-w-0 flex-1 leading-6",
                  done || cancelled ? "text-muted-foreground/60 line-through" : "text-foreground"
                )}>
                  <span className="mr-2 font-mono text-[10px] font-medium text-muted-foreground/40">{String(index + 1).padStart(2, '0')}</span>
                  {todo.description}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function summarizeBranchContent(content: string): string {
  if (!content) return '(empty)';

  const TOOL_CALL_TAG_REGEX = /<tool-call[^>]*>[\s\S]*?<\/tool-call>/g;
  const textOnly = content.replace(TOOL_CALL_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim();
  if (textOnly) return textOnly;

  const firstTag = content.match(/<tool-call[^>]*\/>/)?.[0];
  if (!firstTag) return '(empty)';

  // Simple tool name extraction without getToolCallAttribute
  const nameMatch = firstTag.match(/name=["']([^"']+)["']/);
  const statusMatch = firstTag.match(/status=["']([^"']+)["']/);
  const name = nameMatch?.[1];
  const status = statusMatch?.[1];
  if (name && status) return `Tool ${name} (${status})`;
  if (name) return `Tool ${name}`;
  return '[tool call]';
}

export const SidePanel = React.memo(function SidePanel({
  sidePanelType,
  sidePanelWidth,
  setSidePanelWidth,
  messages,
  messagesMap,
  headId,
  setHeadId,
  showInfoToast,
  artifactPath,
  onCloseArtifact,
  workspacePath,
  sessionId,
  onSessionRunStateChange,
  onOpenArtifact,
  onOpenFile,
  onSelectPanel,
  onClosePanel,
}: SidePanelProps) {
  // Ref for direct DOM manipulation to avoid React re-renders during drag
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Use resize hook for panel width (reverse for left edge)
  const { size, isResizing, handleProps } = useResize({
    direction: 'horizontal',
    minSize: 250,
    maxSize: 800,
    initialSize: sidePanelWidth,
    reverse: true,
    onResize: setSidePanelWidth,
    liveResizeCallback: false,
  });

  // Direct DOM update for smooth dragging - bypasses React reconciliation
  useEffect(() => {
    if (!panelRef.current) return;

    // Cancel any pending frame
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (panelRef.current) {
        panelRef.current.style.width = sidePanelType ? `${size}px` : '0px';
      }
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [size, sidePanelType]);

  // Graph data computation
  const graphMessages: GraphMessage[] = useMemo(() => {
    if (sidePanelType !== 'graph') return [];
    return transformToGraphMessage(messagesMap, headId);
  }, [messagesMap, headId, sidePanelType]);

  // Branch insights computation
  const branchInsights: BranchInsightsData = useMemo(() => {
    return computeBranchInsights(graphMessages, headId);
  }, [graphMessages, headId]);

  // Branch jump messages for display
  const branchJumpMessages = useMemo(() => {
    return getBranchJumpMessages(branchInsights.branchPointIds, messagesMap);
  }, [branchInsights.branchPointIds, messagesMap]);

  const latestTodos = useMemo(() => getLatestTodos(messages), [messages]);
  const latestPlan = useMemo(() => getLatestPlan(messages), [messages]);
  const currentPanel = sidePanelType === 'artifact' ? 'artifact' : sidePanelType;
  const panelTabs = useMemo(() => [
    { type: 'artifact' as const, label: 'Preview', icon: FileCode2, enabled: Boolean(artifactPath) },
    { type: 'tasks' as const, label: 'Tasks', icon: LayoutList, enabled: true, badge: latestTodos?.length },
    { type: 'plan' as const, label: 'Plan', icon: Code2, enabled: true },
    { type: 'terminal' as const, label: 'Terminal', icon: TerminalSquare, enabled: true },
    { type: 'files' as const, label: 'Files', icon: FolderTree, enabled: true },
    { type: 'modules' as const, label: 'Modules', icon: LayoutGrid, enabled: true },
    { type: 'usage' as const, label: 'Usage', icon: TrendingUp, enabled: true },
    { type: 'graph' as const, label: 'Graph', icon: GitBranch, enabled: true, lowPriority: true },
    { type: 'timeline' as const, label: 'Time', icon: Clock, enabled: true, lowPriority: true },
  ], [artifactPath, latestTodos?.length]);

  // Event handlers
  const handleNodeClick = useCallback((nodeId: string) => {
    setHeadId(nodeId);
  }, [setHeadId]);

  const highlightMessage = useCallback((id: string) => {
    const el = document.getElementById(`message-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      el.classList.add('message-highlight');

      // Wait for scroll (approx 450ms) before starting the 800ms removal timer
      setTimeout(() => {
        setTimeout(() => {
          el.classList.remove('message-highlight');
        }, 800);
      }, 450);
    }
  }, []);

  // Stable callback for message click
  const handleMessageClick = useCallback((index: number) => {
    const msg = messages[index];
    if (msg && msg.id) {
      highlightMessage(msg.id);
    }
  }, [messages, highlightMessage]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex-none border-r bg-muted/5 relative flex flex-col overflow-hidden",
        // Disable transition during resize for smooth dragging, add will-change for optimization
        !isResizing && "transition-[width] duration-200 ease-in-out will-change-[width]",
        !sidePanelType && "w-0 border-none"
      )}
      style={{ contain: 'layout style' }}
    >
      <AnimatePresence mode="wait">
        {sidePanelType && (
          <motion.div
            key="workbench"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 flex flex-col bg-background"
          >
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/40 bg-gradient-to-b from-background to-muted/[0.02] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <PanelSwitcher
                currentPanel={currentPanel || 'tasks'}
                tabs={panelTabs}
                onSelect={(type) => onSelectPanel?.(type)}
              />
              <button
                type="button"
                onClick={onClosePanel}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-[var(--bg-hover)] hover:text-foreground active:scale-[0.92] focus:outline-none"
                title="Close workbench"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {sidePanelType === 'graph' && (
                <div className="flex h-full flex-col">
                  <div className="flex-1 min-h-0 relative">
                    <ConversationGraph
                      messages={graphMessages}
                      currentLeafId={headId}
                      onNodeClick={handleNodeClick}
                      onCopyNotification={showInfoToast}
                      className="absolute inset-0"
                    />
                  </div>
                  <div className="border-t border-border/40 shrink-0">
                    <BranchInsights
                      nodeCount={branchInsights.nodeCount}
                      leafCount={branchInsights.leafCount}
                      maxDepth={branchInsights.maxDepth}
                      branchPointCount={branchInsights.branchPointIds.length}
                      onBranchPointClick={handleNodeClick}
                      branchPoints={branchJumpMessages.map((m) => ({
                        id: m.id,
                        content: summarizeBranchContent(m.message.content),
                        role: m.message.role,
                      }))}
                    />
                  </div>
                </div>
              )}

              {sidePanelType === 'timeline' && (
                <div className="h-full overflow-y-auto">
                  <div className="px-3 py-2">
                    <MessageTimeline
                      messages={messages}
                      currentIndex={messages.length - 1}
                      onMessageClick={handleMessageClick}
                    />
                  </div>
                </div>
              )}

              {sidePanelType === 'artifact' && (
                artifactPath ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <ArtifactPreview
                      filePath={artifactPath}
                      onClose={() => onCloseArtifact?.()}
                      className="h-full w-full border-l-0 shadow-none"
                    />
                  </motion.div>
                ) : (
                  <EmptyPane icon={FileCode2} title="No preview selected" body="Open an HTML artifact or media file from chat to preview it here." />
                )
              )}

              {sidePanelType === 'tasks' && <TasksPane todos={latestTodos} />}

              {sidePanelType === 'plan' && (
                latestPlan ? (
                  <div className="h-full overflow-y-auto">
                    <div className="border-b border-border/30 px-4 py-2.5 bg-gradient-to-b from-muted/[0.03] to-transparent">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent-subtle)]">
                          <Code2 className="h-3 w-3 text-[var(--accent)]" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">Current Plan</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <PlanBlock content={latestPlan} />
                    </div>
                  </div>
                ) : (
                  <EmptyPane icon={Activity} title="No plan yet" body="Plan mode output will appear here when the agent proposes or updates a checklist." />
                )
              )}

              {sidePanelType === 'terminal' && (
                <div className="h-full bg-[#0a0a0b] dark:bg-[#0a0a0b] bg-gradient-to-b from-zinc-950 to-black">
                  <TerminalPanel
                    workspacePath={workspacePath}
                    sessionId={sessionId}
                    onSessionRunStateChange={onSessionRunStateChange}
                    onClose={() => onSelectPanel?.('tasks')}
                    variant="side"
                  />
                </div>
              )}

              {sidePanelType === 'files' && (
                <div className="h-full bg-background">
                  <div className="border-b border-border/30 px-4 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <FolderTree className="h-3.5 w-3.5" />
                      <span>Workspace Files</span>
                    </div>
                  </div>
                  <div className="h-[calc(100%-33px)]">
                    <FileTree
                      className="h-full"
                      initialPath={workspacePath}
                      onFileSelect={(file) => {
                        if (file.path.endsWith('.html')) {
                          onOpenArtifact?.(file.path);
                        } else {
                          onOpenFile?.(file);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {sidePanelType === 'modules' && (
                <ModulesPane workspacePath={workspacePath} currentSessionId={sessionId} />
              )}

              {sidePanelType === 'usage' && (
                <UsagePane currentSessionId={sessionId} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left Resize Handle (at edge with main content) */}
      <ResizeHandle
        direction="horizontal"
        isResizing={isResizing}
        onMouseDown={handleProps.onMouseDown}
        className="absolute top-0 left-0 h-full"
        indicatorClassName="bg-[var(--border-subtle)]"
      />
    </div>
  );
});
