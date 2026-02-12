'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Maximize2, Minimize2, Network } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Message } from '../components/MessageBubble';
import { SkillsDialog } from '../components/SkillsDialog';
import { SettingsDialog, ChatSettings } from '../components/SettingsDialog';
import { cn } from '@/lib/utils';
import { ConversationGraph, GraphMessage } from '../components/ConversationGraph';

import { ChatContainer } from '../components/ChatContainer';
import { ConfirmationDialog, ConfirmationDetails } from '../components/ConfirmationDialog';
import { QuestionPanel, Question } from '../components/QuestionPanel';
import { HookEvent } from '../components/HooksPanel';
import { UsageStatsDialog } from '../components/UsageStatsDialog';
import { AddWorkspaceDialog } from '../components/AddWorkspaceDialog';


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
  sessionId?: string;
  error?: boolean;
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

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);

  // -- Tree State --
  // We use a Map to store all messages by ID
  const [messagesMap, setMessagesMap] = useState<Map<string, Message>>(new Map());
  // headId points to the current "tip" of the conversation
  const [headId, setHeadId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'gemini-3-pro-preview',
    systemInstruction: '',
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
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsageStats, setShowUsageStats] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [mode, setMode] = useState<'code' | 'plan' | 'ask'>('code');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [previewFile, setPreviewFile] = useState<{ name: string; path: string } | null>(null);
  const [approvalMode, setApprovalMode] = useState<'safe' | 'auto'>('safe');
  const [showGraph, setShowGraph] = useState(false);
  const [isBranchInsightsMinimized, setIsBranchInsightsMinimized] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(120);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // -- Graph Data for Visualization --
  const graphMessages: GraphMessage[] = useMemo(() => {
    // Only generate graph data if graph is shown to save performance
    if (!showGraph) return [];

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
  }, [messagesMap, headId, showGraph]);

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
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

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
        const parsed = JSON.parse(saved) as ChatSettings;
        const allowedModels = new Set([
          'gemini-3-pro-preview',
          'gemini-3-flash-preview',
          'gemini-2.5-pro',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite',
        ]);

        setSettings({
          ...parsed,
          model: allowedModels.has(parsed.model)
            ? parsed.model
            : 'gemini-3-pro-preview',
        });
      } catch (e) { console.error('Failed to parse settings', e); }
    }
  }, []);

  const handleSaveSettings = (newSettings: ChatSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gem-ui-settings', JSON.stringify(newSettings));
  };

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

    setMessagesMap(nextMap);
    setHeadId(nextHeadId);

    return data;
  }, []);

  // Handle Session Selection
  const handleSelectSession = async (id: string) => {
    if (id === currentSessionId) return;

    setIsLoading(true);
    setCurrentSessionId(id);

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
      setIsLoading(false);
      // Close sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setCurrentWorkspace(null);
    setMessagesMap(new Map());
    setHeadId(null);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChatInWorkspace = (workspace: string) => {
    setCurrentSessionId(null);
    setCurrentWorkspace(workspace);
    setMessagesMap(new Map());
    setHeadId(null);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleAddWorkspace = (workspacePath: string) => {
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


  const handleSendMessage = async (
    text: string,
    options?: { parentId?: string; approvalMode?: 'safe' | 'auto' }
  ) => {
    if (!text.trim() || isLoading) return;

    // Handle slash commands
    const trimmedInput = text.trim();
    if (trimmedInput.startsWith('/clear')) {
      handleNewChat();
      return;
    }

    if (trimmedInput.startsWith('/rewind')) {
      if (!currentSessionId) {
        addMessageToTree({ role: 'model', content: '⚠️ 当前没有可回退的会话。' }, headId);
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
        addMessageToTree({ role: 'model', content: `⚠️ 回退失败：${data.error || '未知错误'}` }, headId);
        return;
      }

      try {
        await loadSessionTree(currentSessionId);
        await fetchSessions();
      } catch (error) {
        console.error('Failed to reload session after rewind', error);
      }
      return;
    }

    if (trimmedInput.startsWith('/restore')) {
      if (!currentSessionId) {
        addMessageToTree({ role: 'model', content: '⚠️ 当前没有可恢复的会话。' }, headId);
        return;
      }

      const toolId = trimmedInput.split(/\s+/)[1];
      if (!toolId) {
        addMessageToTree({ role: 'model', content: '⚠️ 用法：`/restore [tool_id]`' }, headId);
        return;
      }

      const restoreRes = await fetch('/api/chat/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          sessionId: currentSessionId,
          toolId,
          workspace: currentWorkspace,
          model: settings.model
        })
      });

      if (!restoreRes.ok) {
        const data = await restoreRes.json().catch(() => ({}));
        addMessageToTree({ role: 'model', content: `⚠️ 恢复失败：${data.error || '未知错误'}` }, headId);
        return;
      }
      console.info(`[chat] restored checkpoint for tool ${toolId}`);
      return;
    }

    setIsLoading(true);

    // Determine parent ID: passed option or current head
    const parentIdToUse = options?.parentId !== undefined ? options.parentId : headId;

    // 1. Add User Message
    const userMsgId = addMessageToTree({ role: 'user', content: text }, parentIdToUse);
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buildCompletedToolCallTag = ({
      id,
      name,
      args,
      status,
      output,
      resultData,
    }: {
      id: string;
      name: string;
      args: string;
      status: 'completed' | 'failed';
      output?: string;
      resultData?: unknown;
    }) => {
      const encodedResult = encodeURIComponent(output || '');
      let encodedResultData: string | undefined;
      if (resultData !== undefined) {
        try {
          encodedResultData = encodeURIComponent(JSON.stringify(resultData));
        } catch {
          encodedResultData = undefined;
        }
      }
      return `<tool-call id="${id}" name="${name}" args="${args}" status="${status}" result="${encodedResult}"${
        encodedResultData ? ` result_data="${encodedResultData}"` : ''
      } />`;
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          model: settings.model,
          systemInstruction: settings.systemInstruction,
          sessionId: currentSessionId,
          workspace: currentWorkspace,
          mode,
          approvalMode: options?.approvalMode ?? approvalMode,
          modelSettings: settings.modelSettings,
          parentId: parentIdToUse // Pass tree context
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

      // 2. Initialize Assistant Message
      // The assistant message's parent is the user message we just created
      const assistantMsgId = addMessageToTree({ role: 'model', content: '' }, userMsgId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let assistantThought = '';
      const assistantCitations: string[] = [];
      let streamSessionId = currentSessionId;

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
              if (!streamSessionId) {
                streamSessionId = data.session_id;
                setCurrentSessionId(data.session_id);
                fetchSessions();
              }
            }

            if (data.type === 'thought' && data.content) {
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
              const hookEvent: HookEvent = {
                id: data.id || Math.random().toString(36).substr(2, 9),
                name: data.hookName || data.name,
                type: data.type === 'hook' ? data.value?.type : data.hook_type || data.type,
                timestamp: Date.now(),
                data: data.value?.input || data.input,
                outcome: data.value?.output || data.output,
                duration: data.value?.duration || data.duration
              };

              // Map some values if type is hook
              if (data.type === 'hook') {
                hookEvent.type = data.value?.type; // 'start' | 'end'
              }

              setHookEvents(prev => [hookEvent, ...prev.slice(0, 49)]);
            }

            if (data.type === 'tool_use') {
              const toolName = String(data.tool_name || 'Unknown Tool');
              const toolCallTag = `\n\n<tool-call id="${data.tool_id || ''}" name="${toolName}" args="${encodeURIComponent(JSON.stringify(data.parameters || data.args || {}))}" status="running" />\n\n`;
              assistantContent += toolCallTag;
              updateMessageInTree(assistantMsgId, { content: assistantContent });
            }

            if (data.type === 'tool_result') {
              const resolvedStatus = data.is_error ? 'failed' : 'completed';
              const resolvedOutput = data.output || data.result || '';
              const resolvedResultData = data.result_data;
              const resolvedToolId = data.tool_id ? String(data.tool_id) : '';

              if (resolvedToolId) {
                const exactRegex = new RegExp(
                  `<tool-call id="${escapeRegex(resolvedToolId)}" name="([^"]*)" args="([^"]*)" status="running" \\/>`
                );
                const exactMatch = assistantContent.match(exactRegex);
                if (exactMatch) {
                  assistantContent = assistantContent.replace(
                    exactRegex,
                    buildCompletedToolCallTag({
                      id: resolvedToolId,
                      name: exactMatch[1],
                      args: exactMatch[2],
                      status: resolvedStatus,
                      output: resolvedOutput,
                      resultData: resolvedResultData,
                    })
                  );
                  updateMessageInTree(assistantMsgId, { content: assistantContent });
                  continue;
                }
              }

              const fallbackRegex = /<tool-call id="([^"]*)" name="([^"]*)" args="([^"]*)" status="running" \/>/g;
              let fallbackMatch: RegExpExecArray | null;
              let lastMatch: RegExpExecArray | null = null;

              while ((fallbackMatch = fallbackRegex.exec(assistantContent)) !== null) {
                lastMatch = fallbackMatch;
              }

              if (lastMatch) {
                const [fullMatch, fallbackId, fallbackName, fallbackArgs] = lastMatch;
                const updatedTag = buildCompletedToolCallTag({
                  id: resolvedToolId || fallbackId,
                  name: fallbackName,
                  args: fallbackArgs,
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

            if (data.type === 'result') {
              if (data.status === 'error' && data.error) {
                const errorMsg = data.error.message || data.error.type || 'Unknown API error';
                assistantContent += `\n\n> ⚠️ **Error**: ${errorMsg}`;
                updateMessageInTree(assistantMsgId, { content: assistantContent, error: true });
              }
              if (data.stats) {
                updateMessageInTree(assistantMsgId, { stats: data.stats });
              }
            }
          } catch (e) {
            console.error('JSON parse error', e);
          }
        }
      }

      // Final refresh to keep local tree ids in sync with persisted ids.
      await fetchSessions();
      if (streamSessionId) {
        try {
          await loadSessionTree(streamSessionId);
        } catch (reloadError) {
          console.error('Failed to reload session tree after turn', reloadError);
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      // We should probably add an error message node if we haven't already
      // But we already added an assistant node. Let's update it.
      // Note: we don't have access to assistantMsgId easily here unless we scoped it. 
      // We can use headId but we must be careful. 
      // For now, let's just log. Better error handling requires refs or more state.
      // Actually we can add a new error message if we failed BEFORE creating assistant node.
    } finally {
      setIsLoading(false);
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
    // Just stop loading? Or delete the branch?
    // For now, simple client-side stop would require AbortController which we haven't wired up full yet (fetch supports it).
    // Let's just implement visual "pruning" or "rewind" to the parent.

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
    } else {
      // Root
      setHeadId(null);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    setHeadId(nodeId);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased">
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
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          onNewChatInWorkspace={handleNewChatInWorkspace}
          currentWorkspace={currentWorkspace === null ? undefined : currentWorkspace}
          onAddWorkspace={() => setShowAddWorkspace(true)}
          onOpenSkills={() => setSkillsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          isDark={theme === 'dark'}
          toggleTheme={toggleTheme}
          onShowStats={() => setShowUsageStats(true)}
          onFileSelect={(file) => setPreviewFile(file)}
          hookEvents={hookEvents}
          onSelectAgent={(agent) => setSelectedAgent(agent)}
          selectedAgentName={selectedAgent?.name}
        />
      </div>

      <SkillsDialog
        open={skillsOpen}
        onClose={() => setSkillsOpen(false)}
      />

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
        <div className="flex items-center justify-between border-b px-4 py-2">
          <Header stats={sessionStats} onShowStats={() => setShowUsageStats(true)} />
          <button
            onClick={() => setShowGraph(!showGraph)}
            className={cn(
              "p-2 rounded-md transition-colors",
              showGraph ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
            )}
            title="Toggle Conversation Graph"
          >
            <Network className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Graph Panel */}
          {showGraph && (
            <div className="w-[44%] min-w-[420px] max-w-[900px] border-r bg-muted/10 relative">
              <ConversationGraph
                messages={graphMessages}
                currentLeafId={headId}
                onNodeClick={handleNodeClick}
              />

              <div className="pointer-events-none absolute right-3 top-3 z-20">
                <aside
                  className={cn(
                    'pointer-events-auto max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-border/70 bg-background/90 backdrop-blur-md p-3 shadow-xl transition-all',
                    isBranchInsightsMinimized ? 'w-[228px] space-y-2' : 'w-[280px] space-y-3'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Branch Insights</div>
                    <button
                      type="button"
                      onClick={() => setIsBranchInsightsMinimized((value) => !value)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      title={isBranchInsightsMinimized ? 'Expand Branch Insights' : 'Minimize Branch Insights'}
                    >
                      {isBranchInsightsMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>
                  </div>

                  {isBranchInsightsMinimized ? (
                    <>
                      <div className="grid grid-cols-4 gap-1.5">
                        <MiniInsightBadge label="N" value={String(branchInsights.nodeCount)} />
                        <MiniInsightBadge label="L" value={String(branchInsights.leafCount)} />
                        <MiniInsightBadge label="F" value={String(branchInsights.branchPointIds.length)} />
                        <MiniInsightBadge label="D" value={String(branchInsights.maxDepth)} />
                      </div>
                      <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground truncate">
                        {headId ? `Head #${headId}` : 'No active node'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <InsightCard label="Nodes" value={String(branchInsights.nodeCount)} />
                        <InsightCard label="Leafs" value={String(branchInsights.leafCount)} />
                        <InsightCard label="Forks" value={String(branchInsights.branchPointIds.length)} />
                        <InsightCard label="Depth" value={String(branchInsights.maxDepth)} />
                      </div>

                      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">Active Branch</div>
                        <div className="text-sm font-medium text-foreground">
                          {headId ? `Head #${headId}` : 'No active node'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Path depth: {branchInsights.activeDepth}
                        </div>
                        {selectedGraphMessage && (
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-4 break-words">
                            {summarizeBranchContent(selectedGraphMessage.content)}
                          </div>
                        )}
                      </div>

                      {branchJumpMessages.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Fork Nodes</div>
                          {branchJumpMessages.map(({ id, message }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setHeadId(id)}
                              className={cn(
                                'w-full text-left rounded-md border px-2 py-1.5 transition-colors',
                                id === headId
                                  ? 'border-primary/60 bg-primary/10 text-primary'
                                  : 'border-border/70 bg-muted/10 hover:bg-muted/30'
                              )}
                            >
                              <div className="text-xs font-medium truncate">#{id}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {summarizeBranchContent(message.content)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>
            </div>
          )}

          {/* Chat Area */}
          <ChatContainer
            messages={messages}
            isLoading={isLoading}
            previewFile={previewFile}
            onClosePreview={() => setPreviewFile(null)}
            settings={settings}
            onSendMessage={handleSendMessage}
            onRetry={handleRetry}
            onCancel={handleCancel}
            onModelChange={(model) => setSettings(s => ({ ...s, model }))}
            currentModel={settings.model}
            sessionStats={sessionStats}
            currentContextUsage={currentContextUsage}
            mode={mode}
            onModeChange={(m: 'code' | 'plan' | 'ask') => setMode(m)}
            onApprovalModeChange={setApprovalMode}
            workspacePath={currentWorkspace || undefined}
            onInputHeightChange={(height) => {
              setInputAreaHeight((prev) => (Math.abs(prev - height) > 1 ? height : prev));
            }}
          />
        </div>
        {confirmation && (
          <ConfirmationDialog
            details={confirmation.details}
            onConfirm={(mode) => handleConfirm(true, mode ?? 'once')}
            onCancel={() => handleConfirm(false, 'once')}
            bottomOffset={inputAreaHeight}
          />
        )}
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
