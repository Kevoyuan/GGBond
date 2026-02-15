'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Maximize2, Minimize2, Network, Clock, Sparkles, ListOrdered } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Message } from '../components/MessageBubble';
import { SettingsDialog, ChatSettings } from '../components/SettingsDialog';
import { cn } from '@/lib/utils';
import { ConversationGraph, GraphMessage } from '../components/ConversationGraph';
import { BranchInsights } from '../components/BranchInsights';
import { MessageTimeline } from '../components/MessageTimeline';

import { ChatContainer } from '../components/ChatContainer';
import { ConfirmationDialog, ConfirmationDetails } from '../components/ConfirmationDialog';
import { QuestionPanel, Question } from '../components/QuestionPanel';
import { HookEvent } from '../components/HooksPanel';
import { UsageStatsDialog } from '../components/UsageStatsDialog';
import { AddWorkspaceDialog } from '../components/AddWorkspaceDialog';
import { TerminalPanel } from '../components/TerminalPanel';
import { UndoMessageConfirmDialog, UndoPreviewFileChange } from '../components/UndoMessageConfirmDialog';
import { Toast, ToastContainer, ToastType } from '../components/Toast';


interface Session {
  id: string;
  title: string;
  created_at: string | number;
  updated_at: string | number;
  workspace?: string;
  isCore?: boolean;
  lastUpdated?: string;
}

interface ApiMessageRecord {
  id?: string | number | null;
  role?: string;
  content?: string;
  parentId?: string | number | null;
  parent_id?: string | number | null;
  stats?: unknown;
  thought?: string;
  citations?: string[];
  images?: Array<{ dataUrl: string; type: string; name: string }>;
  sessionId?: string;
  error?: boolean;
}

interface UndoConfirmState {
  sessionId: string;
  messageId: string;
  messageContent: string;
  workspace: string | null;
  model: string;
  hasCheckpoint: boolean;
  fileChanges: UndoPreviewFileChange[];
}

const toMessageId = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const toStatsValue = (value: unknown): Message['stats'] | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Message['stats'];
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') {
    return value as Message['stats'];
  }
  return undefined;
};

const TOOL_CALL_TAG_REGEX = /<tool-call[^>]*\/>/g;
const DEFAULT_TERMINAL_PANEL_HEIGHT = 360;

const getToolCallAttribute = (tag: string, key: string) => {
  const match = tag.match(new RegExp(`${key}="([^"]*)"`));
  return match?.[1] || '';
};

const buildTreeFromApiMessages = (rawMessages: ApiMessageRecord[]) => {
  const normalized = rawMessages.map((rawMessage, index) => {
    const id = toMessageId(rawMessage.id, `msg-${index}`);
    const parentCandidateRaw = rawMessage.parentId ?? rawMessage.parent_id ?? null;
    const parentCandidate = parentCandidateRaw === null || parentCandidateRaw === undefined
      ? null
      : String(parentCandidateRaw);

    const normalizedMessage: Message = {
      id,
      role: rawMessage.role === 'user' ? 'user' : 'model',
      content: typeof rawMessage.content === 'string' ? rawMessage.content : '',
      stats: toStatsValue(rawMessage.stats),
      parentId: null,
      thought: typeof rawMessage.thought === 'string' ? rawMessage.thought : undefined,
      citations: Array.isArray(rawMessage.citations) ? rawMessage.citations : undefined,
      images: Array.isArray(rawMessage.images) ? rawMessage.images : undefined,
      sessionId: typeof rawMessage.sessionId === 'string' ? rawMessage.sessionId : undefined,
      error: Boolean(rawMessage.error),
    };

    return {
      id,
      parentCandidate,
      message: normalizedMessage,
    };
  });

  const knownIds = new Set(normalized.map((entry) => entry.id));
  const hasExplicitParents = normalized.some((entry) => entry.parentCandidate !== null);
  const nextMap = new Map<string, Message>();
  let previousId: string | null = null;

  for (const entry of normalized) {
    let parentId: string | null = null;

    if (
      entry.parentCandidate &&
      knownIds.has(entry.parentCandidate) &&
      entry.parentCandidate !== entry.id
    ) {
      parentId = entry.parentCandidate;
    } else if (!hasExplicitParents && previousId) {
      parentId = previousId;
    }

    nextMap.set(entry.id, {
      ...entry.message,
      parentId,
    });

    previousId = entry.id;
  }

  const nextHeadId = normalized.length > 0 ? normalized[normalized.length - 1].id : null;
  return { nextMap, nextHeadId };
};

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function MiniInsightBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-1.5 py-1 text-center">
      <div className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

const summarizeBranchContent = (content: string) => {
  if (!content) return '(empty)';

  const textOnly = content.replace(TOOL_CALL_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim();
  if (textOnly) return textOnly;

  const firstTag = content.match(/<tool-call[^>]*\/>/)?.[0];
  if (!firstTag) return '(empty)';

  const name = getToolCallAttribute(firstTag, 'name');
  const status = getToolCallAttribute(firstTag, 'status');
  if (name && status) return `Tool ${name} (${status})`;
  if (name) return `Tool ${name}`;
  return '[tool call]';
};

const ALLOWED_MODELS = new Set([
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  model: 'gemini-3-pro-preview',
  systemInstruction: '',
  toolPermissionStrategy: 'safe',
  ui: {
    footer: {
      hideModelInfo: false,
      hideContextPercentage: false,
    },
    showMemoryUsage: true,
  },
  modelSettings: {
    compressionThreshold: 0.5,
    maxSessionTurns: -1,
    tokenBudget: 2000,
  }
};

const normalizeChatSettings = (input: Partial<ChatSettings> | null | undefined): ChatSettings => {
  const safeInput = input || {};
  const nextModel = ALLOWED_MODELS.has(safeInput.model || '')
    ? (safeInput.model as string)
    : DEFAULT_CHAT_SETTINGS.model;

  return {
    model: nextModel,
    systemInstruction: safeInput.systemInstruction ?? DEFAULT_CHAT_SETTINGS.systemInstruction,
    toolPermissionStrategy: safeInput.toolPermissionStrategy === 'auto' ? 'auto' : 'safe',
    ui: {
      footer: {
        hideModelInfo: safeInput.ui?.footer?.hideModelInfo ?? DEFAULT_CHAT_SETTINGS.ui.footer.hideModelInfo,
        hideContextPercentage: safeInput.ui?.footer?.hideContextPercentage ?? DEFAULT_CHAT_SETTINGS.ui.footer.hideContextPercentage,
      },
      showMemoryUsage: safeInput.ui?.showMemoryUsage ?? DEFAULT_CHAT_SETTINGS.ui.showMemoryUsage,
    },
    modelSettings: {
      compressionThreshold: safeInput.modelSettings?.compressionThreshold ?? DEFAULT_CHAT_SETTINGS.modelSettings.compressionThreshold,
      maxSessionTurns: safeInput.modelSettings?.maxSessionTurns ?? DEFAULT_CHAT_SETTINGS.modelSettings.maxSessionTurns,
      tokenBudget: safeInput.modelSettings?.tokenBudget ?? DEFAULT_CHAT_SETTINGS.modelSettings.tokenBudget,
    },
  };
};

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

  // -- Tree State --
  // We use a Map to store all messages by ID
  const [messagesMap, setMessagesMap] = useState<Map<string, Message>>(new Map());
  // headId points to the current "tip" of the conversation
  const [headId, setHeadId] = useState<string | null>(null);
  const headIdRef = useRef<string | null>(null);

  // Sync state to ref (for parts of the app that only read headId state)
  // but we primarily update headIdRef manually for synchronous access.
  useEffect(() => {
    headIdRef.current = headId;
  }, [headId]);

  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [runningSessionCounts, setRunningSessionCounts] = useState<Record<string, number>>({});
  const [terminalRunningSessionCounts, setTerminalRunningSessionCounts] = useState<Record<string, number>>({});
  // Track sessions with unread completed messages (not the current viewed session)
  const [unreadSessionIds, setUnreadSessionIds] = useState<Set<string>>(new Set());

  // Settings state
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsageStats, setShowUsageStats] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [mode, setMode] = useState<'code' | 'plan' | 'ask'>('code');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [previewFile, setPreviewFile] = useState<{ name: string; path: string } | null>(null);
  const [approvalMode, setApprovalMode] = useState<'safe' | 'auto'>(DEFAULT_CHAT_SETTINGS.toolPermissionStrategy);
  const [sidePanelType, setSidePanelType] = useState<'graph' | 'timeline' | null>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isBranchInsightsMinimized, setIsBranchInsightsMinimized] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(120);
  const [terminalPanelHeight, setTerminalPanelHeight] = useState(DEFAULT_TERMINAL_PANEL_HEIGHT);
  const [streamingStatus, setStreamingStatus] = useState<string | undefined>(undefined);
  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast helper functions
  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showErrorToast = useCallback((message: string, duration = 6000) => {
    addToast('error', message, duration);
  }, [addToast]);

  const showWarningToast = useCallback((message: string, duration = 5000) => {
    addToast('warning', message, duration);
  }, [addToast]);

  const showSuccessToast = useCallback((message: string, duration = 4000) => {
    addToast('success', message, duration);
  }, [addToast]);

  const showInfoToast = useCallback((message: string, duration = 4000) => {
    addToast('info', message, duration);
  }, [addToast]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidePanelRef = useRef<HTMLDivElement>(null);
  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  const activeChatAbortRef = useRef<AbortController | null>(null);
  const aiProcessingRef = useRef(false); // Track if AI is currently processing
  const loadSessionTreeRef = useRef<typeof loadSessionTree | null>(null);

  // -- Derived Linear Thread --
  const messages = useMemo(() => {
    const list: Message[] = [];
    let currentId = headId;
    let depth = 0;
    while (currentId && depth < 2000) { // Safety limit
      const msg = messagesMap.get(currentId);
      if (!msg) break;
      list.unshift(msg);
      currentId = msg.parentId || null;
      depth++;
    }
    return list;
  }, [headId, messagesMap]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Handle Resizing with Performance Optimization
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidePanelWidth;
    setIsResizing(true); // Keep state for UI feedback (blue handle), but don't rely on it for drag logic
  }, [sidePanelWidth]);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);

    // Sync final width to state
    if (sidePanelRef.current) {
      const finalWidth = parseInt(sidePanelRef.current.style.width, 10);
      if (!isNaN(finalWidth)) {
        setSidePanelWidth(finalWidth);
      }
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !sidePanelRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      // Panel is on the left, so width increases as mouse moves right (positive delta)
      const delta = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;

      if (newWidth > 280 && newWidth < 800) {
        if (sidePanelRef.current) {
          sidePanelRef.current.style.width = `${newWidth}px`;
        }
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [resize, stopResizing]);

  // Handle page visibility changes for background continuity
  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const checkBackgroundJobs = async () => {
      if (!currentSessionId || !loadSessionTreeRef.current) return;

      try {
        const res = await fetch(`/api/chat/status?sessionId=${currentSessionId}`);
        if (res.ok) {
          const data = await res.json();
          // If there are running jobs in background, reload the session tree
          if (data.hasRunningJobs) {
            console.log('[visibility] Background job detected, reloading session...');
            await loadSessionTreeRef.current(currentSessionId);
          }
        }
      } catch (e) {
        console.error('[visibility] Failed to check background status:', e);
      }
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';

      if (isVisible) {
        // Page became visible - check and refresh immediately
        void checkBackgroundJobs();
        // Stop polling when visible
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      } else {
        // Page became hidden - start polling to keep track of background jobs
        // Poll every 5 seconds when hidden to update status
        pollInterval = setInterval(() => {
          void checkBackgroundJobs();
        }, 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Initial check
    if (document.visibilityState === 'hidden') {
      pollInterval = setInterval(() => {
        void checkBackgroundJobs();
      }, 5000);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentSessionId]);

  const updateRunningSessionCount = useCallback((sessionId: string | null | undefined, delta: number) => {
    if (!sessionId || !Number.isFinite(delta) || delta === 0) return;

    setRunningSessionCounts((prev) => {
      const current = prev[sessionId] ?? 0;
      const nextCount = Math.max(0, current + delta);
      if (nextCount === current) return prev;

      const next = { ...prev };
      if (nextCount === 0) {
        delete next[sessionId];
      } else {
        next[sessionId] = nextCount;
      }
      return next;
    });
  }, []);

  const runningSessionIds = useMemo(
    () => Object.keys(runningSessionCounts).filter((sessionId) => (runningSessionCounts[sessionId] ?? 0) > 0),
    [runningSessionCounts]
  );

  const updateTerminalRunningSessionCount = useCallback((sessionId: string | null | undefined, delta: number) => {
    if (!sessionId || !Number.isFinite(delta) || delta === 0) return;

    setTerminalRunningSessionCounts((prev) => {
      const current = prev[sessionId] ?? 0;
      const nextCount = Math.max(0, current + delta);
      if (nextCount === current) return prev;

      const next = { ...prev };
      if (nextCount === 0) {
        delete next[sessionId];
      } else {
        next[sessionId] = nextCount;
      }
      return next;
    });
  }, []);

  const terminalRunningSessionIds = useMemo(
    () =>
      Object.keys(terminalRunningSessionCounts).filter(
        (sessionId) => (terminalRunningSessionCounts[sessionId] ?? 0) > 0
      ),
    [terminalRunningSessionCounts]
  );

  const isCurrentSessionRunning = useMemo(() => {
    if (!currentSessionId) return false;
    return (runningSessionCounts[currentSessionId] ?? 0) > 0;
  }, [currentSessionId, runningSessionCounts]);

  const isLoading = isSessionLoading || isCurrentSessionRunning;

  // -- Graph Data for Visualization --
  const graphMessages: GraphMessage[] = useMemo(() => {
    // Only generate graph data if graph is shown to save performance
    if (sidePanelType !== 'graph') return [];

    return Array.from(messagesMap.entries()).map(([mapId, msg]) => {
      const stableId = msg.id || mapId;
      return {
        id: stableId,
        parentId: msg.parentId || null,
        role: msg.role,
        content: msg.content,
        isLeaf: stableId === headId
      };
    });
  }, [messagesMap, headId, sidePanelType]);

  const branchInsights = useMemo(() => {
    if (!graphMessages.length) {
      return {
        nodeCount: 0,
        leafCount: 0,
        branchPointIds: [] as string[],
        maxDepth: 0,
        activeDepth: 0,
      };
    }

    const parentById = new Map<string, string | null>();
    const childrenById = new Map<string, string[]>();

    for (const message of graphMessages) {
      parentById.set(message.id, message.parentId);
      childrenById.set(message.id, []);
    }

    for (const message of graphMessages) {
      if (message.parentId && childrenById.has(message.parentId)) {
        childrenById.get(message.parentId)?.push(message.id);
      }
    }

    const roots = graphMessages
      .filter((message) => !message.parentId || !childrenById.has(message.parentId))
      .map((message) => message.id);

    if (!roots.length) {
      roots.push(graphMessages[0].id);
    }

    const depthById = new Map<string, number>();
    const visited = new Set<string>();
    const queue = roots.map((id) => ({ id, depth: 0 }));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);
      depthById.set(current.id, current.depth);
      const children = childrenById.get(current.id) || [];
      for (const childId of children) {
        queue.push({ id: childId, depth: current.depth + 1 });
      }
    }

    const maxDepth = Array.from(depthById.values()).reduce((max, depth) => Math.max(max, depth), 0);
    const branchPointIds = Array.from(childrenById.entries())
      .filter(([, children]) => children.length > 1)
      .sort((a, b) => (depthById.get(a[0]) || 0) - (depthById.get(b[0]) || 0))
      .map(([id]) => id);
    const leafCount = Array.from(childrenById.values()).filter((children) => children.length === 0).length;

    let activeDepth = 0;
    let cursor = headId;
    const pathGuard = new Set<string>();
    while (cursor && !pathGuard.has(cursor)) {
      pathGuard.add(cursor);
      const parent = parentById.get(cursor) || null;
      if (!parent) break;
      activeDepth += 1;
      cursor = parent;
    }

    return {
      nodeCount: graphMessages.length,
      leafCount,
      branchPointIds,
      maxDepth,
      activeDepth,
    };
  }, [graphMessages, headId]);

  const selectedGraphMessage = useMemo(() => {
    if (!headId) return null;
    return messagesMap.get(headId) || null;
  }, [messagesMap, headId]);

  const branchJumpMessages = useMemo(() => {
    return branchInsights.branchPointIds
      .map((id) => ({ id, message: messagesMap.get(id) }))
      .filter((entry): entry is { id: string; message: Message } => Boolean(entry.message))
      .slice(0, 6);
  }, [branchInsights.branchPointIds, messagesMap]);

  const [confirmation, setConfirmation] = useState<{ details: ConfirmationDetails, correlationId: string } | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{
    questions: Question[];
    title: string;
    correlationId: string;
    source: 'confirmation';
  } | null>(null);
  const [undoConfirm, setUndoConfirm] = useState<UndoConfirmState | null>(null);
  const [isApplyingUndoMessage, setIsApplyingUndoMessage] = useState(false);
  const [inputPrefillRequest, setInputPrefillRequest] = useState<{ id: number; text: string } | null>(null);
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  // Queue message states - in-memory queue for pending messages
  const [pendingMessages, setPendingMessages] = useState<{ content: string; images?: UploadedImage[]; tempId?: string }[]>([]);
  const pendingMessagesRef = useRef<{ content: string; images?: UploadedImage[]; tempId?: string; parentId?: string; sessionId: string }[]>([]);
  const [showQueueIndicator, setShowQueueIndicator] = useState(false);

  const sessionStats = useMemo(() => {
    return messages.reduce((acc, msg) => {
      if (msg.stats) {
        acc.inputTokens += msg.stats.inputTokenCount || msg.stats.input_tokens || 0;
        acc.outputTokens += msg.stats.outputTokenCount || msg.stats.output_tokens || 0;
        acc.totalTokens += msg.stats.totalTokenCount || msg.stats.total_tokens || ((msg.stats.inputTokenCount || msg.stats.input_tokens || 0) + (msg.stats.outputTokenCount || msg.stats.output_tokens || 0));
        acc.totalCost += msg.stats.totalCost || 0;
      }
      return acc;
    }, { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0 });
  }, [messages]);

  const currentContextUsage = useMemo(() => {
    if (messages.length === 0) return 0;
    // Simplified context usage calculation for tree structure
    // We basically just take the stats from the last message that has them in the current branch
    for (let i = messages.length - 1; i >= 0; i--) {
      const stats = messages[i].stats;
      if (stats) {
        return (stats.totalTokenCount || stats.total_tokens || 0);
      }
    }
    return 0;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]); // Scroll on new messages or loading state change

  // Load Settings
  useEffect(() => {
    const saved = localStorage.getItem('gem-ui-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<ChatSettings>;
        const normalized = normalizeChatSettings(parsed);
        setSettings(normalized);
        setApprovalMode(normalized.toolPermissionStrategy);
      } catch (e) { console.error('Failed to parse settings', e); }
    }
  }, []);

  const handleSaveSettings = (newSettings: ChatSettings) => {
    const normalized = normalizeChatSettings(newSettings);
    setSettings(normalized);
    setApprovalMode(normalized.toolPermissionStrategy);
    localStorage.setItem('gem-ui-settings', JSON.stringify(normalized));
  };

  const handleApprovalModeChange = useCallback((mode: 'safe' | 'auto') => {
    setApprovalMode(mode);
    setSettings((prev) => {
      if (prev.toolPermissionStrategy === mode) {
        return prev;
      }
      const next = { ...prev, toolPermissionStrategy: mode };
      localStorage.setItem('gem-ui-settings', JSON.stringify(next));
      return next;
    });
  }, []);

  // Load Theme
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  };

  // Fetch Sessions on Mount
  const fetchSessions = async () => {
    try {
      const dbRes = await fetch('/api/sessions');
      const coreRes = await fetch('/api/sessions/core');

      let allSessions: Session[] = [];

      if (dbRes.ok) {
        const dbSessions = await dbRes.json();
        allSessions = [...dbSessions];
      }

      if (coreRes.ok) {
        const coreSessions = await coreRes.json();
        // Avoid duplicates if IDs match, though they shouldn't usually
        const coreFiltered = coreSessions.filter((cs: any) => !allSessions.some(s => s.id === cs.id));
        allSessions = [...allSessions, ...coreFiltered];
      }

      // Sort by updated_at desc
      allSessions.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.lastUpdated || 0).getTime();
        const timeB = new Date(b.updated_at || b.lastUpdated || 0).getTime();
        return timeB - timeA;
      });

      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const loadSessionTree = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to load session: ${sessionId}`);
    }

    const data = await res.json() as { messages?: ApiMessageRecord[]; session?: Session };
    const rawMessages = Array.isArray(data.messages) ? data.messages : [];
    const { nextMap, nextHeadId } = buildTreeFromApiMessages(rawMessages);

    // Merge pending messages into the map to preserve them
    // This handles the case where loadSessionTree is called while messages are queued locally
    const pendingMessages = pendingMessagesRef.current;
    if (pendingMessages.length > 0) {
      pendingMessages.forEach(pm => {
        // Only add if it belongs to this session
        const queueId = pm.tempId || `queued-${Date.now()}-${Math.random()}`;
        if (pm.sessionId === sessionId && !nextMap.has(queueId)) {
          nextMap.set(queueId, {
            id: queueId,
            role: 'user',
            content: pm.content,
            queued: true,
            parentId: (pm.parentId || nextHeadId) ?? null, // Ensure string | null
            sessionId: pm.sessionId,
            images: pm.images?.map(img => ({
              dataUrl: img.dataUrl,
              type: img.file.type,
              name: img.file.name
            }))
          });
        }
      });
      // We don't necessarily update headId here because the queue processor will pick them up
      // and attach them properly. But we ensure they exist in the map.
    }

    setMessagesMap(nextMap);
    setHeadId(nextHeadId);
    headIdRef.current = nextHeadId;

    return { ...data, nextMap, nextHeadId };
  }, []);

  // Keep ref updated with latest loadSessionTree function
  loadSessionTreeRef.current = loadSessionTree;

  // Handle Session Selection
  const handleSelectSession = async (id: string) => {
    if (id === currentSessionId) return;

    setIsSessionLoading(true);
    setCurrentSessionId(id);

    // Mark this session as read (clear unread)
    setUnreadSessionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // Find session to set workspace
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentWorkspace(session.workspace || null);
    }

    try {
      const data = await loadSessionTree(id);
      if (!session && data.session?.workspace) {
        setCurrentWorkspace(data.session.workspace || null);
      }
    } catch (error) {
      console.error('Failed to load session', error);
    } finally {
      setIsSessionLoading(false);
      // Close sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  const handleNewChat = () => {
    // Note: We intentionally do NOT stop running sessions here
    // Multiple sessions can run concurrently
    // But we clear the abort ref so new messages can be sent in new session
    activeChatAbortRef.current = null;
    setCurrentSessionId(null);
    setCurrentWorkspace(null);
    setMessagesMap(new Map());
    setHeadId(null);
    headIdRef.current = null;
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChatInWorkspace = (workspace: string) => {
    // Note: We intentionally do NOT stop running sessions here
    // Multiple sessions can run concurrently
    // But we clear the abort ref so new messages can be sent in new session
    activeChatAbortRef.current = null;
    setCurrentSessionId(null);
    setCurrentWorkspace(workspace);
    setMessagesMap(new Map());
    setHeadId(null);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleAddWorkspace = (workspacePath: string) => {
    // Note: We intentionally do NOT stop running sessions here
    // Multiple sessions can run concurrently
    // But we clear the abort ref so new messages can be sent in new session
    activeChatAbortRef.current = null;
    setCurrentSessionId(null);
    setCurrentWorkspace(workspacePath);
    setMessagesMap(new Map());
    setHeadId(null);
  };

  const handleDeleteSession = async (id: string) => {
    try {
      console.log('Deleting session:', id);
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session', error);
    }
  };

  // Helper to add a new message to the tree
  const addMessageToTree = useCallback((msg: Message, parentId: string | null) => {
    const newId = msg.id ? String(msg.id) : `temp-${Date.now()}-${Math.random()}`;
    const normalizedParentId = parentId ? String(parentId) : null;
    const newMessage = { ...msg, id: newId, parentId: normalizedParentId };

    setMessagesMap(prev => {
      const next = new Map(prev);
      next.set(newId, newMessage);
      return next;
    });
    setHeadId(newId);
    headIdRef.current = newId;
    return newId;
  }, []);

  // Helper to update a message in the tree
  const updateMessageInTree = useCallback((id: string, updates: Partial<Message>) => {
    setMessagesMap(prev => {
      const next = new Map(prev);
      const msg = next.get(id);
      if (msg) {
        next.set(id, { ...msg, ...updates });
      }
      return next;
    });
  }, []);

  const handleStopMessage = useCallback(() => {
    const activeAbort = activeChatAbortRef.current;
    if (!activeAbort || activeAbort.signal.aborted) return;
    activeAbort.abort();
  }, []);


  interface UploadedImage {
    id: string;
    file: File;
    preview: string;
    dataUrl: string;
  }

  // Handle queue message processing - use in-memory queue
  const handleProcessNextQueueItem = async () => {
    // Check ref for current processing state to avoid stale closure
    // But we CAN process if aiProcessingRef is false (which it should be when this is called)
    if (aiProcessingRef.current) {
      return;
    }

    // Get the next message from ref (always current) and remove from queue
    const currentMessages = pendingMessagesRef.current;
    if (currentMessages.length === 0) return;

    const [nextMsg, ...remaining] = currentMessages;
    pendingMessagesRef.current = remaining;
    setPendingMessages(remaining);

    let effectiveHeadId = headIdRef.current;

    // Switch to the correct session if needed
    if (nextMsg.sessionId && nextMsg.sessionId !== currentSessionId) {
      console.log(`[queue] Switching session from ${currentSessionId} to ${nextMsg.sessionId}`);
      // Load the session first and get the latest headId synchronously
      if (loadSessionTreeRef.current) {
        const data = await loadSessionTreeRef.current(nextMsg.sessionId);
        setCurrentSessionId(nextMsg.sessionId);
        effectiveHeadId = data.nextHeadId;

        // Update workspace if session has one
        if (data.session?.workspace) {
          setCurrentWorkspace(data.session.workspace || null);
        }
      }
    }

    // Send the message using current effectiveHeadId as parent (not the stored parentId which may be a tempId or stale)
    // This ensures the message is properly attached to the conversation tree
    await handleSendMessage(nextMsg.content, {
      images: nextMsg.images,
      reuseMessageId: nextMsg.tempId,
      parentId: effectiveHeadId || undefined,
      sessionId: nextMsg.sessionId
    });
  };

  // Add message to queue - show directly in chat as queued message
  const handleAddToQueue = async (text: string, images?: UploadedImage[]) => {
    if (!currentSessionId) return;

    // Determine the parent ID: if there are already queued messages, use the last one's ID
    // Otherwise use headIdRef.current (the synchronous latest message)
    const lastQueuedMsg = pendingMessagesRef.current[pendingMessagesRef.current.length - 1];
    const parentId = (lastQueuedMsg?.tempId || headIdRef.current) ?? undefined;

    // Add to pending messages array with a temp ID and session ID
    const tempId = `queued-${Date.now()}`;
    const newMsg: { content: string; images?: UploadedImage[]; tempId: string; parentId?: string; sessionId: string } = { content: text, images, tempId, sessionId: currentSessionId };
    if (parentId) newMsg.parentId = parentId;
    pendingMessagesRef.current = [...pendingMessagesRef.current, newMsg];
    setPendingMessages(prev => [...prev, newMsg]);

    // Add queued message bubble to chat with correct parent
    addMessageToTree({
      id: tempId, // Use the generated tempId as the primary ID
      role: 'user',
      content: text,
      queued: true,
      tempId,
      sessionId: currentSessionId
    }, parentId || null);

  };

  // Process queued messages
  const processQueue = async () => {
    if (pendingMessages.length === 0) {
      return;
    }

    const nextMsg = pendingMessages[0];

    // Remove from queue
    setPendingMessages(prev => prev.slice(1));

    // Update the pending message to no longer be pending (it's now being sent)
    // Actually we need to remove the pending message and re-send it

    // First remove the pending message from UI
    // Then send it properly
    await handleSendMessage(nextMsg.content, { images: nextMsg.images });
  };

  const handleSendMessage = async (
    text: string,
    options?: { parentId?: string; approvalMode?: 'safe' | 'auto'; images?: UploadedImage[]; reuseMessageId?: string; sessionId?: string; agentName?: string }
  ) => {
    // Allow sending if there's text OR images
    if (!text.trim() && (!options?.images || options.images.length === 0)) return;
    if (isSessionLoading) return;

    // If AI is currently processing, auto-queue the message
    // BUT if we are reusing a message ID, it means we are processing the queue, so don't re-queue it!
    if (aiProcessingRef.current && !options?.reuseMessageId) {
      await handleAddToQueue(text, options?.images);
      return;
    }

    // Handle slash commands (only if there's text)
    const trimmedInput = text.trim();
    // Handle slash commands (only if there's text)
    if (trimmedInput) {
      if (trimmedInput.startsWith('/clear')) {
        handleNewChat();
        return;
      }

      if (trimmedInput.startsWith('/doctor')) {
        const runHealthCheck = async (name: string, url: string) => {
          const startedAt = Date.now();
          try {
            const res = await fetch(url);
            return {
              name,
              ok: res.ok,
              status: res.status,
              latency: Date.now() - startedAt,
            };
          } catch (error) {
            return {
              name,
              ok: false,
              status: null as number | null,
              latency: Date.now() - startedAt,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        };

        const [modelsHealth, statsHealth, sessionsHealth] = await Promise.all([
          runHealthCheck('models', '/api/models'),
          runHealthCheck('stats', '/api/stats'),
          runHealthCheck('sessions', '/api/sessions'),
        ]);

        const workspaceLabel = currentWorkspace || 'Default workspace';
        const healthRows = [modelsHealth, statsHealth, sessionsHealth]
          .map((item) => {
            const status = item.ok
              ? `OK (${item.status})`
              : `FAIL${item.status ? ` (${item.status})` : ''}`;
            const detail = item.error ? ` · ${item.error}` : '';
            return `- ${item.name}: ${status} · ${item.latency}ms${detail}`;
          })
          .join('\n');

        const report = [
          '## Doctor Report',
          '',
          `- Time: ${new Date().toLocaleString()}`,
          `- Session ID: \`${currentSessionId || 'none'}\``,
          `- Workspace: \`${workspaceLabel}\``,
          `- Model: \`${settings.model}\``,
          `- Mode: \`${mode}\``,
          `- Permission Strategy: \`${approvalMode}\``,
          '',
          '### Runtime Snapshot',
          `- Messages in current branch: **${messages.length}**`,
          `- Graph nodes: **${branchInsights.nodeCount}**`,
          `- Branch points: **${branchInsights.branchPointIds.length}**`,
          `- Active hooks tracked: **${hookEvents.length}**`,
          `- Running session tasks: **${runningSessionIds.length}**`,
          '',
          '### API Health',
          healthRows,
        ].join('\n');

        addMessageToTree({ role: 'model', content: report }, headId);
        return;
      }
    }

    if (trimmedInput.startsWith('/cost')) {
      const formatUsd = (value: number) => `$${value.toFixed(6)}`;
      const sessionReport = [
        '### Current Session',
        `- Input tokens: **${sessionStats.inputTokens.toLocaleString()}**`,
        `- Output tokens: **${sessionStats.outputTokens.toLocaleString()}**`,
        `- Total tokens: **${sessionStats.totalTokens.toLocaleString()}**`,
        `- Estimated cost: **${formatUsd(sessionStats.totalCost)}**`,
      ];

      try {
        const res = await fetch('/api/stats');
        if (!res.ok) {
          throw new Error(`stats API ${res.status}`);
        }
        const data = await res.json();
        const globalReport = [
          '### Global Usage',
          `- Daily: ${data.daily?.totalTokens?.toLocaleString?.() ?? 0} tokens · ${formatUsd(data.daily?.cost || 0)}`,
          `- Weekly: ${data.weekly?.totalTokens?.toLocaleString?.() ?? 0} tokens · ${formatUsd(data.weekly?.cost || 0)}`,
          `- Monthly: ${data.monthly?.totalTokens?.toLocaleString?.() ?? 0} tokens · ${formatUsd(data.monthly?.cost || 0)}`,
          `- Total: ${data.total?.totalTokens?.toLocaleString?.() ?? 0} tokens · ${formatUsd(data.total?.cost || 0)}`,
        ];

        addMessageToTree({
          role: 'model',
          content: ['## Cost Report', '', ...sessionReport, '', ...globalReport].join('\n'),
        }, headId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addMessageToTree({
          role: 'model',
          content: ['## Cost Report', '', ...sessionReport, '', `> ⚠️ Failed to fetch global stats: ${message}`].join('\n'),
        }, headId);
      }
      return;
    }

    if (trimmedInput.startsWith('/analyze-project')) {
      const query = new URLSearchParams({
        index: '1',
        limit: '500',
      });
      if (currentWorkspace) {
        query.set('path', currentWorkspace);
      }

      const rootQuery = new URLSearchParams();
      if (currentWorkspace) {
        rootQuery.set('path', currentWorkspace);
      }

      try {
        const [deepRes, rootRes] = await Promise.all([
          fetch(`/api/files?${query.toString()}`),
          fetch(`/api/files?${rootQuery.toString()}`),
        ]);
        if (!deepRes.ok) {
          throw new Error(`index API ${deepRes.status}`);
        }

        const deepData = await deepRes.json();
        const rootData = rootRes.ok ? await rootRes.json() : { files: [] };
        const indexedFiles = Array.isArray(deepData.files) ? deepData.files : [];
        const rootFiles = Array.isArray(rootData.files) ? rootData.files : [];

        const fileEntries = indexedFiles.filter((item: { type?: string }) => item.type === 'file');
        const dirEntries = indexedFiles.filter((item: { type?: string }) => item.type === 'directory');

        const extensionCounts = new Map<string, number>();
        fileEntries.forEach((item: { extension?: string | null }) => {
          const ext = item.extension || '(no-ext)';
          extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
        });
        const topExtensions = Array.from(extensionCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        const topDirectories: string[] = rootFiles
          .filter((item: { type?: string }) => item.type === 'directory')
          .map((item: { name?: string }) => item.name || '')
          .filter(Boolean)
          .slice(0, 12);

        const rootFileSet = new Set(
          rootFiles
            .filter((item: { type?: string }) => item.type === 'file')
            .map((item: { name?: string }) => (item.name || '').toLowerCase())
        );

        const stackSignals: string[] = [];
        if (rootFileSet.has('package.json')) stackSignals.push('Node.js project');
        if (rootFileSet.has('tsconfig.json')) stackSignals.push('TypeScript enabled');
        if (rootFileSet.has('next.config.ts') || rootFileSet.has('next.config.js')) stackSignals.push('Next.js detected');
        if (rootFileSet.has('vitest.config.ts')) stackSignals.push('Vitest tests configured');
        if (rootFileSet.has('eslint.config.mjs')) stackSignals.push('ESLint configured');

        const extensionLines = topExtensions.length > 0
          ? topExtensions.map(([ext, count]) => `- \`${ext}\`: ${count}`).join('\n')
          : '- No files indexed';

        const directoryLines = topDirectories.length > 0
          ? topDirectories.map((dir) => `- \`${dir}/\``).join('\n')
          : '- No top-level directories';

        const signalLines = stackSignals.length > 0
          ? stackSignals.map((item) => `- ${item}`).join('\n')
          : '- No obvious stack signal found from root files';

        const report = [
          '## Project Structure Report',
          '',
          `- Scope: \`${deepData.path || currentWorkspace || 'workspace'}\``,
          `- Indexed entries: **${indexedFiles.length}** (limit: 500)`,
          `- Directories (sampled): **${dirEntries.length}**`,
          `- Files (sampled): **${fileEntries.length}**`,
          '',
          '### Top-level Directories',
          directoryLines,
          '',
          '### File Composition (Top Extensions)',
          extensionLines,
          '',
          '### Stack Signals',
          signalLines,
          '',
          indexedFiles.length >= 500
            ? '> ℹ️ Index is capped at 500 entries for responsiveness. Use narrower scope if needed.'
            : '> ✅ Full index fetched under current cap.',
        ].join('\n');

        addMessageToTree({ role: 'model', content: report }, headId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addMessageToTree({
          role: 'model',
          content: `## Project Structure Report\n\n> ⚠️ Failed to analyze project: ${message}`,
        }, headId);
      }
      return;
    }

    if (trimmedInput.startsWith('/rewind')) {
      if (!currentSessionId) {
        addMessageToTree({ role: 'model', content: '⚠️ No session to rewind.' }, headId);
        return;
      }

      const rewindRes = await fetch('/api/chat/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rewind',
          sessionId: currentSessionId,
          workspace: currentWorkspace,
          model: settings.model
        })
      });

      if (!rewindRes.ok) {
        const data = await rewindRes.json().catch(() => ({}));
        addMessageToTree({ role: 'model', content: `⚠️ Rewind failed: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      try {
        await loadSessionTree(currentSessionId);
        await fetchSessions();
      } catch (error) {
        console.error('Failed to reload session after rewind', error);
        showWarningToast('Session rewind succeeded but failed to reload the session tree');
      }
      return;
    }

    if (trimmedInput.startsWith('/restore')) {
      if (!currentSessionId) {
        addMessageToTree({ role: 'model', content: '⚠️ No session to restore.' }, headId);
        return;
      }

      const restoreId = trimmedInput.split(/\s+/)[1];
      if (!restoreId) {
        addMessageToTree({ role: 'model', content: '⚠️ Usage: `/restore [checkpoint_id]`' }, headId);
        return;
      }

      const restoreRes = await fetch('/api/chat/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          sessionId: currentSessionId,
          checkpointId: restoreId,
          toolId: restoreId,
          workspace: currentWorkspace,
          model: settings.model
        })
      });

      if (!restoreRes.ok) {
        const data = await restoreRes.json().catch(() => ({}));
        addMessageToTree({ role: 'model', content: `⚠️ Restore failed: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      const restoreData = await restoreRes.json().catch(() => ({} as Record<string, unknown>));
      const restoredCheckpoint = typeof restoreData.restoreResult === 'object' && restoreData.restoreResult
        ? String((restoreData.restoreResult as { checkpoint?: unknown }).checkpoint || restoreId)
        : restoreId;
      addMessageToTree({ role: 'model', content: `✅ Restored checkpoint: \`${restoredCheckpoint}\`` }, headId);
      console.info(`[chat] restored checkpoint ${restoredCheckpoint}`);
      return;
    }

    // Determine parent ID: passed option or current head (via ref for sync consistency)
    const parentIdToUseRaw = options?.parentId !== undefined ? options.parentId : headIdRef.current;
    const parentIdToUse = parentIdToUseRaw ? String(parentIdToUseRaw) : null;
    const resolvePersistedParentId = (candidateId: string | null): string | undefined => {
      if (!candidateId) return undefined;
      const visited = new Set<string>();
      let cursor: string | null = candidateId;
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        if (/^\d+$/.test(cursor)) {
          return cursor;
        }
        const nextParent: string | null | undefined = messagesMap.get(cursor)?.parentId;
        cursor = nextParent ? String(nextParent) : null;
      }
      return undefined;
    };
    const apiParentId = resolvePersistedParentId(parentIdToUse);

    const generatedSessionId = options?.sessionId || currentSessionId || crypto.randomUUID();
    const initialSessionIdAtSend = generatedSessionId;
    const selectedSessionIdAtSend = currentSessionIdRef.current;
    let trackedRunningSessionId: string | null = initialSessionIdAtSend;
    let streamSessionId: string | null = initialSessionIdAtSend;
    let abortedByUser = false;

    if (!currentSessionId && currentSessionIdRef.current === selectedSessionIdAtSend) {
      setCurrentSessionId(generatedSessionId);
    }

    if (trackedRunningSessionId) {
      updateRunningSessionCount(trackedRunningSessionId, 1);
    }

    // 1. Add User Message (with images if provided)
    const messageImages = options?.images?.map(img => ({
      dataUrl: img.dataUrl,
      type: img.file.type,
      name: img.file.name,
    }));

    // If reusing a message ID (from queue), we update the existing message instead of creating a new one
    let userMsgId: string;

    if (options?.reuseMessageId) {
      userMsgId = options.reuseMessageId;

      // Safety check: if message got wiped from tree (e.g. by a background refresh), re-add it
      if (!messagesMap.has(userMsgId)) {
        addMessageToTree({
          id: userMsgId,
          role: 'user',
          content: text,
          images: messageImages,
          sessionId: generatedSessionId,
          parentId: parentIdToUse
        }, parentIdToUse);
        if (headIdRef.current === userMsgId || !headIdRef.current) {
          setHeadId(userMsgId);
          headIdRef.current = userMsgId;
        }
      } else {
        // Update the existing message to remove the queued flag and ensure it's firmly in the tree
        updateMessageInTree(userMsgId, {
          id: userMsgId, // Ensure ID matches
          role: 'user',
          content: text,
          images: messageImages,
          queued: false, // Clear queued status
          parentId: parentIdToUse, // Update parent if needed (though usually same head)
          sessionId: generatedSessionId
        });
        // Also set head to this message if it's at the end
        if (headIdRef.current === userMsgId || !headIdRef.current) {
          setHeadId(userMsgId);
          headIdRef.current = userMsgId;
        }
      }
    } else {
      userMsgId = addMessageToTree({
        role: 'user',
        content: text,
        images: messageImages,
        sessionId: generatedSessionId
      }, parentIdToUse);
    }
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const decodeAttr = (value?: string) => {
      if (!value) return undefined;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    const buildCompletedToolCallTag = ({
      id,
      name,
      args,
      checkpoint,
      status,
      output,
      resultData,
    }: {
      id: string;
      name: string;
      args: string;
      checkpoint?: string;
      status: 'completed' | 'failed';
      output?: string;
      resultData?: unknown;
    }) => {
      const encodedResult = encodeURIComponent(output || '');
      const encodedCheckpoint = checkpoint ? encodeURIComponent(checkpoint) : undefined;
      let encodedResultData: string | undefined;
      if (resultData !== undefined) {
        try {
          encodedResultData = encodeURIComponent(JSON.stringify(resultData));
        } catch {
          encodedResultData = undefined;
        }
      }
      return `<tool-call id="${id}" name="${name}" args="${args}"${encodedCheckpoint ? ` checkpoint="${encodedCheckpoint}"` : ''
        } status="${status}" result="${encodedResult}"${encodedResultData ? ` result_data="${encodedResultData}"` : ''
        } />`;
    };

    const requestAbortController = new AbortController();
    activeChatAbortRef.current = requestAbortController;
    aiProcessingRef.current = true;
    setStreamingStatus("Initializing...");

    // Variables for tracking assistant message - declared here so they're accessible in catch
    let assistantMsgId: string | undefined;
    let assistantContent = '';
    const assistantHooks: HookEvent[] = [];
    const assistantCitations: string[] = [];

    try {
      // Prepare images for API
      const images = options?.images?.map(img => ({
        dataUrl: img.dataUrl,
        type: img.file.type,
        name: img.file.name,
      }));

      // 2. Initialize Assistant Message (Optimistic)
      // The assistant message's parent is the user message we just created
      // We do this BEFORE the fetch to ensure headId is updated immediately,
      // preventing "transient branching" where queued messages attach to userMsgId because
      // the model message hasn't been created yet during the fetch latency.
      assistantMsgId = addMessageToTree({ role: 'model', content: '' }, userMsgId);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: requestAbortController.signal,
        body: JSON.stringify({
          prompt: text,
          model: settings.model,
          systemInstruction: settings.systemInstruction,
          sessionId: generatedSessionId,
          workspace: currentWorkspace,
          mode,
          approvalMode: options?.approvalMode ?? approvalMode,
          modelSettings: settings.modelSettings,
          selectedAgent: options?.agentName || selectedAgent?.name,
          // Only persisted numeric IDs are valid for backend parent linkage.
          parentId: apiParentId, // Pass tree context
          images,
        }),
      });
      console.log('[chat/ui] send approval mode', {
        fromOption: options?.approvalMode,
        pageState: approvalMode,
        sent: options?.approvalMode ?? approvalMode,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantThought = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            console.log('[Stream Event]', data.type, data);

            if (data.type === 'init' && data.session_id) {
              setStreamingStatus("Connected...");
              const nextSessionId = String(data.session_id);
              if (!streamSessionId) {
                streamSessionId = nextSessionId;
              }
              if (!trackedRunningSessionId) {
                trackedRunningSessionId = nextSessionId;
                updateRunningSessionCount(nextSessionId, 1);
              }
              if (!initialSessionIdAtSend && currentSessionIdRef.current === selectedSessionIdAtSend) {
                setCurrentSessionId(nextSessionId);
              }
              fetchSessions();
            }

            if (data.type === 'thought' && data.content) {
              setStreamingStatus("Thinking...");
              assistantThought += data.content;
              const updates: Partial<Message> = { thought: assistantThought };
              if (streamSessionId) updates.sessionId = streamSessionId;
              updateMessageInTree(assistantMsgId, updates);
            }

            if (
              data.type === 'tool_confirmation' ||
              data.type === 'tool_call_confirmation' ||
              data.type === 'tool-confirmation-request'
            ) {
              // Handle interactive confirmation
              // Expecting data.value.details which matches ConfirmationDetails structure
              const details = data.value?.details || data.details;
              const correlationId =
                data.value?.correlationId ||
                data.correlationId ||
                details?.correlationId ||
                data.value?.id ||
                data.id;
              if (details) {
                if (details.type === 'ask_user') {
                  const questions = details.questions || [];
                  if (Array.isArray(questions) && correlationId) {
                    setActiveQuestion({
                      questions,
                      title: details.title || 'User Inquiry',
                      correlationId,
                      source: 'confirmation'
                    });
                  }
                  continue;
                }
                setConfirmation({
                  details,
                  correlationId: correlationId || ''
                });
                // We might want to show this in the chat as well? 
                // For now, modal dialog is fine.
              }
            }

            if (data.type === 'citation') {
              assistantCitations.push(data.content);
              updateMessageInTree(assistantMsgId, { citations: [...assistantCitations] });
            }

            if (data.type === 'hook' || data.type === 'hook_event') {
              const hookName = data.hookName || data.name || 'unknown';
              const isStart = data.type === 'hook' ? data.value?.type === 'start' : data.hook_type === 'start';

              if (isStart) {
                setStreamingStatus(`Executing hook: ${hookName}...`);
              }

              // Map legacy hook types to new HookEventType
              const mapHookType = (type: string): HookEvent['type'] => {
                if (type === 'start') return 'tool_call';
                if (type === 'end') return 'tool_result';
                return type as HookEvent['type'];
              };

              const hookEvent: HookEvent = {
                id: data.id || Math.random().toString(36).substr(2, 9),
                name: hookName,
                type: mapHookType(data.type === 'hook' ? (data.value?.type || 'start') : (data.hook_type || 'start')),
                timestamp: Date.now(),
                data: data.value?.input || data.input,
                outcome: data.value?.output || data.output,
                duration: data.value?.duration || data.duration,
                toolName: data.hookName,
                serverName: (data.input as { serverName?: string })?.serverName,
                correlationId: data.correlationId
              };

              setHookEvents(prev => [hookEvent, ...prev.slice(0, 199)]);
            }

            if (data.type === 'tool_use') {
              const toolName = String(data.tool_name || 'Unknown Tool');
              setStreamingStatus(`Running tool: ${toolName}...`);
              const checkpointAttr = typeof data.checkpoint === 'string' && data.checkpoint
                ? ` checkpoint="${encodeURIComponent(data.checkpoint)}"`
                : '';
              const toolCallTag = `\n\n<tool-call id="${data.tool_id || ''}" name="${toolName}" args="${encodeURIComponent(JSON.stringify(data.parameters || data.args || {}))}"${checkpointAttr} status="running" />\n\n`;
              assistantContent += toolCallTag;
              updateMessageInTree(assistantMsgId, { content: assistantContent });
            }

            if (data.type === 'tool_result') {
              setStreamingStatus("Processing tool result...");
              const resolvedStatus = data.is_error ? 'failed' : 'completed';
              const resolvedOutput = data.output || data.result || '';
              const resolvedResultData = data.result_data;
              const resolvedCheckpoint = typeof data.checkpoint === 'string' ? data.checkpoint : undefined;
              const resolvedToolId = data.tool_id ? String(data.tool_id) : '';

              if (resolvedToolId) {
                const exactRegex = new RegExp(
                  `<tool-call id="${escapeRegex(resolvedToolId)}" name="([^"]*)" args="([^"]*)"(?: checkpoint="([^"]*)")? status="running" \\/>`
                );
                const exactMatch = assistantContent.match(exactRegex);
                if (exactMatch) {
                  assistantContent = assistantContent.replace(
                    exactRegex,
                    buildCompletedToolCallTag({
                      id: resolvedToolId,
                      name: exactMatch[1],
                      args: exactMatch[2],
                      checkpoint: resolvedCheckpoint || decodeAttr(exactMatch[3]),
                      status: resolvedStatus,
                      output: resolvedOutput,
                      resultData: resolvedResultData,
                    })
                  );
                  updateMessageInTree(assistantMsgId, { content: assistantContent });
                  continue;
                }
              }

              const fallbackRegex = /<tool-call id="([^"]*)" name="([^"]*)" args="([^"]*)"(?: checkpoint="([^"]*)")? status="running" \/>/g;
              let fallbackMatch: RegExpExecArray | null;
              let lastMatch: RegExpExecArray | null = null;

              while ((fallbackMatch = fallbackRegex.exec(assistantContent)) !== null) {
                lastMatch = fallbackMatch;
              }

              if (lastMatch) {
                const [fullMatch, fallbackId, fallbackName, fallbackArgs, fallbackCheckpoint] = lastMatch;
                const updatedTag = buildCompletedToolCallTag({
                  id: resolvedToolId || fallbackId,
                  name: fallbackName,
                  args: fallbackArgs,
                  checkpoint: resolvedCheckpoint || decodeAttr(fallbackCheckpoint),
                  status: resolvedStatus,
                  output: resolvedOutput,
                  resultData: resolvedResultData,
                });
                assistantContent =
                  assistantContent.slice(0, lastMatch.index) +
                  updatedTag +
                  assistantContent.slice(lastMatch.index + fullMatch.length);
                updateMessageInTree(assistantMsgId, { content: assistantContent });
              }
            }

            if (data.type === 'message' && data.role === 'assistant' && data.content) {
              setStreamingStatus("Generating response...");
              assistantContent += data.content;
              const updates: Partial<Message> = { content: assistantContent };
              if (streamSessionId) updates.sessionId = streamSessionId;
              updateMessageInTree(assistantMsgId, updates);
            }

            if (data.type === 'error') {
              const rawError = data.error;
              const errorMsg =
                (typeof rawError === 'string' && rawError) ||
                rawError?.message ||
                rawError?.error?.message ||
                rawError?.type ||
                'Unknown API error';

              assistantContent += `\n\n> ⚠️ **Error**: ${errorMsg}`;
              updateMessageInTree(assistantMsgId, { content: assistantContent, error: true });
            }

            if (data.type === 'hook_event') {
              // Map legacy hook types to new HookEventType
              const mapHookType = (type: string): HookEvent['type'] => {
                if (type === 'start') return 'tool_call';
                if (type === 'end') return 'tool_result';
                return type as HookEvent['type'];
              };

              const hookEvent: HookEvent = {
                id: data.id,
                name: data.name,
                type: mapHookType(data.hook_type || 'start'),
                timestamp: Date.now(),
                data: data.input,
                outcome: data.output,
                duration: data.duration,
                toolName: data.hookName,
                serverName: (data.input as { serverName?: string })?.serverName,
                correlationId: data.correlationId
              };

              assistantHooks.push(hookEvent);
              updateMessageInTree(assistantMsgId, { hooks: [...assistantHooks] });
            }

            if (data.type === 'result') {
              if (data.status === 'error' && data.error) {
                const errorMsg = data.error.message || data.error.type || 'Unknown API error';
                assistantContent += `\n\n> ⚠️ **Error**: ${errorMsg}`;
                updateMessageInTree(assistantMsgId, { content: assistantContent, error: true, hooks: [...assistantHooks] });
              }
              if (data.stats) {
                updateMessageInTree(assistantMsgId, { stats: data.stats, hooks: [...assistantHooks] });
              }
            }
          } catch (e) {
            console.error('JSON parse error', e);
          }
        }
      }
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      if (isAbortError) {
        abortedByUser = true;
      }
      if (!isAbortError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Chat error:', error);

        // Show error toast notification to user
        showErrorToast(`Failed to get response: ${errorMessage}`, 8000);

        // Try to add error message to conversation if we have access to assistantMsgId
        // This will be undefined if error occurred before assistant message was created
        try {
          if (typeof assistantMsgId !== 'undefined') {
            const errorContent = `\n\n> **Error**: ${errorMessage}\n\nThe conversation was interrupted.`;
            updateMessageInTree(assistantMsgId, { content: errorContent, error: true });
          } else if (userMsgId) {
            // If we failed before creating assistant message, add error as new message
            addMessageToTree({
              role: 'model',
              content: `> **Error**: ${errorMessage}\n\nPlease try again or check the logs for details.`,
              error: true,
            }, userMsgId);
          }
        } catch (updateError) {
          console.error('Failed to update error message in tree:', updateError);
        }
      }
    } finally {
      if (activeChatAbortRef.current === requestAbortController) {
        activeChatAbortRef.current = null;
      }
      setStreamingStatus(undefined);

      try {
        await fetchSessions();
        if (streamSessionId && currentSessionIdRef.current === streamSessionId) {
          await loadSessionTree(streamSessionId);
        }
      } catch (reloadError) {
        const errorMsg = reloadError instanceof Error ? reloadError.message : String(reloadError);
        console.error(
          abortedByUser
            ? 'Failed to reload session tree after abort'
            : 'Failed to reload session tree after turn',
          reloadError
        );
        if (!abortedByUser) {
          showWarningToast(`Session updated but failed to refresh: ${errorMsg}`);
        }
      }

      if (trackedRunningSessionId) {
        updateRunningSessionCount(trackedRunningSessionId, -1);
        aiProcessingRef.current = false;

        // Auto-process queue after AI finishes
        setTimeout(() => {
          // Check pendingMessagesRef at execution time, not closure time
          if (pendingMessagesRef.current.length > 0) {
            handleProcessNextQueueItem();
          }
        }, 100);
      }

      // If this session is not the currently viewed session, mark as unread
      const sessionIdToMark = trackedRunningSessionId;
      if (sessionIdToMark && sessionIdToMark !== currentSessionId) {
        setUnreadSessionIds(prev => {
          const next = new Set(prev);
          next.add(sessionIdToMark);
          return next;
        });
      }
    }
  };

  const handleRetry = (messageIndex: number, _mode: 'once' | 'session') => {
    // Retry needs to branch off from the message *before* the user message that led to this response (or failure).
    // In thread view (messages array), `messageIndex` is the index in the *displayed* list.
    // displayed list is [msg0, msg1, ... msgN] where msg0 is usually user, msg1 is model...

    // 1. Identify the user message to retry.
    // Iterate backwards from messageIndex to find role='user'
    let userMsgIndex = -1;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex === -1) return;

    const userMsg = messages[userMsgIndex];
    if (!userMsg) return;

    // 2. Its parent is the point we want to branch FROM.
    const parentId = userMsg.parentId || null;

    // 3. Trigger send, but pass the *original parent* as the anchor.
    // This creates a NEW sibling to `userMsg`.
    handleSendMessage(userMsg.content, {
      parentId: parentId || undefined
    });
  };

  const handleConfirm = async (approved: boolean, mode: 'once' | 'session' = 'once') => {
    if (!confirmation) return;
    if (!confirmation.correlationId) {
      console.error('Missing confirmation correlationId');
      return;
    }
    const pendingCorrelationId = confirmation.correlationId;

    const outcome = approved
      ? (mode === 'session' ? 'proceed_always' : 'proceed_once')
      : 'cancel';

    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: pendingCorrelationId,
          confirmed: approved,
          outcome
        })
      });
      setConfirmation((prev) => (
        prev?.correlationId === pendingCorrelationId ? null : prev
      ));
    } catch (e) {
      console.error('Failed to submit confirmation', e);
    }
  };

  const handleQuestionSubmit = async (answers: any[]) => {
    if (!activeQuestion) return;
    const pendingQuestion = activeQuestion;

    const normalizedAnswers = Object.fromEntries(
      answers.map((answer, index) => {
        if (Array.isArray(answer)) {
          return [String(index), answer.join(', ')];
        }
        if (answer === null || answer === undefined) {
          return [String(index), ''];
        }
        return [String(index), String(answer)];
      })
    );

    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: pendingQuestion.correlationId,
          confirmed: true,
          outcome: 'proceed_once',
          payload: { answers: normalizedAnswers }
        })
      });
      setActiveQuestion(null);
    } catch (e) {
      console.error('Failed to submit question response', e);
    }
  };

  const handleQuestionCancel = async () => {
    if (!activeQuestion) return;
    const pendingQuestion = activeQuestion;
    try {
      if (pendingQuestion.source === 'confirmation') {
        await fetch('/api/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correlationId: pendingQuestion.correlationId,
            confirmed: false,
            outcome: 'cancel'
          })
        });
      }
    } catch (e) {
      console.error('Failed to cancel question response', e);
    } finally {
      setActiveQuestion(null);
    }
  };


  const handleCancel = (messageIndex: number) => {
    if (isLoading) {
      handleStopMessage();
      return;
    }

    // If not running, fallback to rewinding this branch to the parent message.

    // 1. Identify user message
    let userMsgIndex = -1;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex === -1) return;
    const userMsg = messages[userMsgIndex];

    // Rewind head to parent
    if (userMsg.parentId) {
      setHeadId(userMsg.parentId);
      headIdRef.current = userMsg.parentId;
    } else {
      // Root
      setHeadId(null);
      headIdRef.current = null;
    }
  };

  const pruneLocalBranchFrom = useCallback((rootMessageId: string) => {
    if (!rootMessageId || !messagesMap.has(rootMessageId)) return;

    setMessagesMap(prev => {
      if (!prev.has(rootMessageId)) return prev;
      const next = new Map(prev);
      const stack = [rootMessageId];

      while (stack.length > 0) {
        const current = stack.pop() as string;
        next.delete(current);
        for (const [id, msg] of Array.from(next.entries())) {
          if (msg.parentId === current) {
            stack.push(id);
          }
        }
      }
      return next;
    });

    const parentId = messagesMap.get(rootMessageId)?.parentId ?? null;
    setHeadId(parentId);
    headIdRef.current = parentId;
  }, [messagesMap]);

  const handleUndoTool = async (restoreId: string, sourceMessageId?: string) => {
    if (!currentSessionId) {
      addMessageToTree({ role: 'model', content: '⚠️ No session to restore.' }, headId);
      return;
    }

    if (isLoading) {
      addMessageToTree({ role: 'model', content: '⚠️ Please wait for the current run to finish before undo.' }, headId);
      return;
    }

    if (!restoreId) {
      addMessageToTree({ role: 'model', content: '⚠️ Missing restore checkpoint id.' }, headId);
      return;
    }

    const restoreRes = await fetch('/api/chat/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        sessionId: currentSessionId,
        checkpointId: restoreId,
        toolId: restoreId,
        messageId: sourceMessageId,
        workspace: currentWorkspace,
        model: settings.model
      })
    });

    if (!restoreRes.ok) {
      const data = await restoreRes.json().catch(() => ({}));
      addMessageToTree({ role: 'model', content: `⚠️ Undo failed: ${data.error || 'Unknown error'}` }, headId);
      return;
    }

    const restoreData = await restoreRes.json().catch(() => ({} as Record<string, unknown>));
    const restoredCheckpoint = typeof restoreData.restoreResult === 'object' && restoreData.restoreResult
      ? String((restoreData.restoreResult as { checkpoint?: unknown }).checkpoint || restoreId)
      : restoreId;

    const wasPruned = restoreData.pruned === true;
    if (wasPruned) {
      try {
        await loadSessionTree(currentSessionId);
        await fetchSessions();
        return;
      } catch (error) {
        console.error('Failed to reload session after undo prune', error);
      }
    }

    const fallbackParentId = sourceMessageId
      ? (messagesMap.get(sourceMessageId)?.parentId ?? headId)
      : headId;

    if (sourceMessageId && messagesMap.has(sourceMessageId)) {
      pruneLocalBranchFrom(sourceMessageId);
    }

    addMessageToTree(
      { role: 'model', content: `✅ Undo complete for checkpoint: \`${restoredCheckpoint}\`` },
      fallbackParentId
    );
  };

  const handleUndoMessage = async (messageId: string, messageContent: string) => {
    if (!currentSessionId) {
      addMessageToTree({ role: 'model', content: '⚠️ No session to restore.' }, headId);
      return;
    }

    if (isLoading) {
      addMessageToTree({ role: 'model', content: '⚠️ Please wait for the current run to finish before undo.' }, headId);
      return;
    }

    if (!/^\d+$/.test(messageId)) {
      addMessageToTree({ role: 'model', content: '⚠️ This message cannot be undone yet. Please retry after the turn is saved.' }, headId);
      return;
    }

    const previewRes = await fetch('/api/chat/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'undo_message_preview',
        sessionId: currentSessionId,
        messageId,
        workspace: currentWorkspace,
        model: settings.model
      })
    });

    if (!previewRes.ok) {
      const data = await previewRes.json().catch(() => ({}));
      addMessageToTree({ role: 'model', content: `⚠️ Undo failed: ${data.error || 'Unknown error'}` }, headId);
      return;
    }

    const previewData = await previewRes.json().catch(() => ({} as Record<string, unknown>));
    const rawFileChanges = Array.isArray((previewData as { fileChanges?: unknown[] }).fileChanges)
      ? ((previewData as { fileChanges?: unknown[] }).fileChanges as unknown[])
      : [];
    const fileChanges: UndoPreviewFileChange[] = rawFileChanges
      .map((rawEntry) => {
        if (!rawEntry || typeof rawEntry !== 'object') return null;
        const entry = rawEntry as Record<string, unknown>;

        const pathValue = typeof entry.path === 'string' ? entry.path : '';
        if (!pathValue) return null;

        let status: UndoPreviewFileChange['status'] = 'modified';
        if (entry.status === 'created' || entry.status === 'deleted' || entry.status === 'modified') {
          status = entry.status;
        }

        return {
          path: pathValue,
          displayPath: typeof entry.displayPath === 'string' ? entry.displayPath : pathValue,
          status,
          addedLines: typeof entry.addedLines === 'number' ? entry.addedLines : 0,
          removedLines: typeof entry.removedLines === 'number' ? entry.removedLines : 0,
        };
      })
      .filter((entry): entry is UndoPreviewFileChange => Boolean(entry));

    setUndoConfirm({
      sessionId: currentSessionId,
      messageId,
      messageContent,
      workspace: currentWorkspace,
      model: settings.model,
      hasCheckpoint: Boolean((previewData as { hasCheckpoint?: unknown }).hasCheckpoint),
      fileChanges,
    });
  };

  const handleCancelUndoMessage = () => {
    if (isApplyingUndoMessage) return;
    setUndoConfirm(null);
  };

  const handleConfirmUndoMessage = async () => {
    if (!undoConfirm || isApplyingUndoMessage) return;

    setIsApplyingUndoMessage(true);
    const pending = undoConfirm;

    try {
      const undoRes = await fetch('/api/chat/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo_message',
          sessionId: pending.sessionId,
          messageId: pending.messageId,
          workspace: pending.workspace,
          model: pending.model
        })
      });

      if (!undoRes.ok) {
        const data = await undoRes.json().catch(() => ({}));
        addMessageToTree({ role: 'model', content: `⚠️ Undo failed: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      setUndoConfirm(null);
      setInputPrefillRequest({
        id: Date.now(),
        text: pending.messageContent,
      });

      try {
        await loadSessionTree(pending.sessionId);
        await fetchSessions();
      } catch (error) {
        console.error('Failed to reload session after message undo', error);
        showWarningToast('Message undone but failed to refresh session');
      }
    } finally {
      setIsApplyingUndoMessage(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    setHeadId(nodeId);
    headIdRef.current = nodeId;
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} position="top-right" />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "flex h-full"
      )}>
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          runningSessionIds={runningSessionIds}
          terminalRunningSessionIds={terminalRunningSessionIds}
          unreadSessionIds={Array.from(unreadSessionIds)}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          onNewChatInWorkspace={handleNewChatInWorkspace}
          currentWorkspace={currentWorkspace === null ? undefined : currentWorkspace}
          onAddWorkspace={() => setShowAddWorkspace(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          isDark={theme === 'dark'}
          toggleTheme={toggleTheme}
          onShowStats={() => setShowUsageStats(true)}
          onFileSelect={(file) => setPreviewFile(file)}
          hookEvents={hookEvents}
          onClearHooks={() => setHookEvents([])}
          onSelectAgent={(agent) => setSelectedAgent(agent)}
          selectedAgentName={selectedAgent?.name}
          sidePanelType={sidePanelType}
          onToggleSidePanel={(type) => setSidePanelType(current => current === type ? null : type)}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <UsageStatsDialog
        open={showUsageStats}
        onClose={() => setShowUsageStats(false)}
      />

      <AddWorkspaceDialog
        open={showAddWorkspace}
        onClose={() => setShowAddWorkspace(false)}
        onAdd={handleAddWorkspace}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header */}
        <Header stats={sessionStats} onShowStats={() => setShowUsageStats(true)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Side Panel (Graph or Timeline) - Left Side */}
            {sidePanelType && (
              <div
                ref={sidePanelRef}
                className={cn(
                  "flex-none border-r bg-muted/5 relative flex flex-col overflow-hidden",
                  !isResizing && "transition-[width] duration-75 ease-out"
                )}
                style={{ width: sidePanelWidth }}
              >
                {/* Resize Handle (Right edge) */}
                <div
                  onMouseDown={startResizing}
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 transition-colors hover:bg-primary/30",
                    isResizing && "bg-primary/50"
                  )}
                />

                {sidePanelType === 'graph' && (
                  <>
                    <div className="flex-1 min-h-0 relative">
                      <ConversationGraph
                        messages={graphMessages}
                        currentLeafId={headId}
                        onNodeClick={handleNodeClick}
                        onCopyNotification={showInfoToast}
                        className="absolute inset-0"
                      />
                    </div>
                    <BranchInsights
                      nodeCount={branchInsights.nodeCount}
                      leafCount={branchInsights.leafCount}
                      maxDepth={branchInsights.maxDepth}
                      branchPointCount={branchInsights.branchPointIds.length}
                      onBranchPointClick={handleNodeClick}
                      branchPoints={branchJumpMessages.map((m) => ({
                        id: m.id,
                        content: summarizeBranchContent(m.message.content),
                      }))}
                    />
                  </>
                )}

                {sidePanelType === 'timeline' && (
                  <MessageTimeline
                    messages={messages}
                    currentIndex={messages.length - 1}
                    onMessageClick={(index) => {
                      setTimeout(() => {
                        const messageElements = document.querySelectorAll('[data-message-index]');
                        const targetElement = messageElements[index] as HTMLElement;
                        if (targetElement) {
                          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          targetElement.classList.remove('message-highlight');
                          void targetElement.offsetWidth;
                          targetElement.classList.add('message-highlight');
                          setTimeout(() => {
                            targetElement.classList.remove('message-highlight');
                          }, 800);
                        }
                      }, 50);
                    }}
                  />
                )}
              </div>
            )}

            {/* Right Side: Chat + Queue + Terminal (vertical stack) */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Chat Area */}
              <ChatContainer
                messages={messages}
                isLoading={isLoading}
                previewFile={previewFile}
                onClosePreview={() => setPreviewFile(null)}
                settings={settings}
                onSendMessage={handleSendMessage}
                onStopMessage={handleStopMessage}
                onUndoTool={handleUndoTool}
                onUndoMessage={handleUndoMessage}
                inputPrefillRequest={inputPrefillRequest}
                onRetry={handleRetry}
                onCancel={handleCancel}
                onModelChange={(model) => setSettings(s => ({ ...s, model }))}
                currentModel={settings.model}
                sessionStats={sessionStats}
                currentContextUsage={currentContextUsage}
                mode={mode}
                onModeChange={(m: 'code' | 'plan' | 'ask') => setMode(m)}
                approvalMode={approvalMode}
                onApprovalModeChange={handleApprovalModeChange}
                workspacePath={currentWorkspace || undefined}
                showTerminal={showTerminal}
                onToggleTerminal={() => setShowTerminal((value) => !value)}
                onInputHeightChange={(height) => {
                  setInputAreaHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
                }}
                streamingStatus={streamingStatus}
              />

              {/* Terminal Panel */}
              <div className={showTerminal ? '' : 'hidden'}>
                <TerminalPanel
                  workspacePath={currentWorkspace || undefined}
                  sessionId={currentSessionId}
                  onSessionRunStateChange={updateTerminalRunningSessionCount}
                  onClose={() => setShowTerminal(false)}
                  onHeightChange={(height) => {
                    setTerminalPanelHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
                  }}
                />
              </div>
            </div>
          </div>
          {confirmation && (
            <ConfirmationDialog
              details={confirmation.details}
              onConfirm={(mode) => handleConfirm(true, mode ?? 'once')}
              onCancel={() => handleConfirm(false, 'once')}
              bottomOffset={inputAreaHeight + (showTerminal ? terminalPanelHeight : 0)}
            />
          )}
          <UndoMessageConfirmDialog
            open={Boolean(undoConfirm)}
            fileChanges={undoConfirm?.fileChanges || []}
            hasCheckpoint={undoConfirm?.hasCheckpoint || false}
            onCancel={handleCancelUndoMessage}
            onConfirm={() => void handleConfirmUndoMessage()}
            isConfirming={isApplyingUndoMessage}
          />
        </div>
      </div>

      {activeQuestion && (
        <QuestionPanel
          questions={activeQuestion.questions}
          title={activeQuestion.title}
          correlationId={activeQuestion.correlationId}
          onSubmit={handleQuestionSubmit}
          onCancel={handleQuestionCancel}
        />
      )}
    </div>
  );
}
