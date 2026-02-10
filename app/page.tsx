'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Bot, Network } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MessageBubble, LoadingBubble, Message } from '../components/MessageBubble';
import { SkillsDialog } from '../components/SkillsDialog';
import { SettingsDialog, ChatSettings } from '../components/SettingsDialog';
import { cn } from '@/lib/utils';
import { ConversationGraph, GraphMessage } from '../components/ConversationGraph';

import { ChatInput } from '../components/ChatInput';
import { ChatContainer } from '../components/ChatContainer';
import { ConfirmationDialog, ConfirmationDetails } from '../components/ConfirmationDialog';
import { QuestionPanel, Question } from '../components/QuestionPanel';
import { UsageStatsDialog } from '../components/UsageStatsDialog';
import { AddWorkspaceDialog } from '../components/AddWorkspaceDialog';
import { FilePreview } from '../components/FilePreview';
import { ConfirmDialog } from '../components/ConfirmDialog';


interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace?: string;
}

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
    model: 'auto-gemini-3',
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
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    return Array.from(messagesMap.values()).map(msg => ({
      id: msg.id || `temp-${Date.now()}`,
      parentId: msg.parentId || null,
      role: msg.role,
      content: msg.content,
      isLeaf: msg.id === headId
    }));
  }, [messagesMap, headId, showGraph]);

  const [confirmation, setConfirmation] = useState<{ details: ConfirmationDetails, correlationId: string } | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{ questions: Question[], title: string, correlationId: string } | null>(null);

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
        setSettings(JSON.parse(saved));
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
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  useEffect(() => {
    fetchSessions();
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
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages: Message[] = data.messages || [];

        // Rebuild Tree from flat list
        const newMap = new Map<string, Message>();
        let lastMsgId: string | null = null;

        loadedMessages.forEach((msg, index) => {
          const msgId = msg.id || `msg-${index}`; // Ensure ID exists
          // If parentId is missing (legacy), chain them linearly
          if (!msg.parentId && index > 0) {
            // Try to find previous message ID
            // For simplicity in legacy, we assume linear order in array
            const prevMsg = loadedMessages[index - 1];
            msg.parentId = prevMsg.id || `msg-${index - 1}`;
          }

          newMap.set(msgId, { ...msg, id: msgId });
          lastMsgId = msgId;
        });

        setMessagesMap(newMap);
        setHeadId(lastMsgId);
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

  const handleDeleteSession = (id: string) => {
    setSessionToDelete(id);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete;

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
    const newId = msg.id || `temp-${Date.now()}-${Math.random()}`;
    const newMessage = { ...msg, id: newId, parentId };

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


  const handleSendMessage = async (text: string, options?: { forceApproval?: boolean; parentId?: string }) => {
    if (!text.trim() || isLoading) return;

    // Handle slash commands
    const trimmedInput = text.trim();
    if (trimmedInput.startsWith('/clear')) {
      handleNewChat();
      return;
    }

    setIsLoading(true);

    // Determine parent ID: passed option or current head
    const parentIdToUse = options?.parentId !== undefined ? options.parentId : headId;

    // 1. Add User Message
    const userMsgId = addMessageToTree({ role: 'user', content: text }, parentIdToUse);

    // Map UI model aliases to actual CLI model IDs
    let actualModel = settings.model;
    if (settings.model === 'auto-gemini-3') {
      actualModel = 'gemini-3-pro-preview';
    } else if (settings.model === 'auto-gemini-2.5') {
      actualModel = 'gemini-2.5-pro';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          model: actualModel,
          systemInstruction: settings.systemInstruction,
          sessionId: currentSessionId,
          workspace: currentWorkspace,
          mode,
          approvalMode: options?.forceApproval ? 'auto' : approvalMode,
          modelSettings: settings.modelSettings,
          parentId: parentIdToUse // Pass tree context
        }),
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

            if (data.type === 'tool_confirmation' || data.type === 'tool_call_confirmation') {
              // Handle interactive confirmation
              // Expecting data.value.details which matches ConfirmationDetails structure
              const details = data.value?.details || data.details;
              if (details) {
                setConfirmation(details);
                // We might want to show this in the chat as well? 
                // For now, modal dialog is fine.
              }
            }

            if (data.type === 'ask_user' || data.type === 'ask_user_request') {
              // Handle tool questioning
              const questions = data.value?.questions || data.questions;
              const title = data.value?.title || data.title || 'User Inquiry';
              const correlationId = data.value?.correlationId || data.correlationId || data.value?.id || data.id;

              if (questions && correlationId) {
                setActiveQuestion({ questions, title, correlationId });
              }
            }

            if (data.type === 'tool_use') {
              const toolCallTag = `\n\n<tool-call name="${data.tool_name}" args="${encodeURIComponent(JSON.stringify(data.parameters || data.args || {}))}" status="running" />\n\n`;
              assistantContent += toolCallTag;
              updateMessageInTree(assistantMsgId, { content: assistantContent });
            }

            if (data.type === 'tool_result') {
              // Regex replace for tool status
              const regex = /<tool-call name="([^"]+)" args="([^"]+)" status="running" \/>/g;
              let match;
              let lastMatchIndex = -1;

              while ((match = regex.exec(assistantContent)) !== null) {
                lastMatchIndex = match.index;
              }

              if (lastMatchIndex !== -1) {
                const before = assistantContent.substring(0, lastMatchIndex);
                const after = assistantContent.substring(lastMatchIndex);

                const updatedTag = after.replace(
                  'status="running" />',
                  `status="${data.is_error ? 'failed' : 'completed'}" result="${encodeURIComponent(data.output || data.result || '')}" />`
                );

                assistantContent = before + updatedTag;
                updateMessageInTree(assistantMsgId, { content: assistantContent });
              }
            }

            if (data.type === 'message' && data.role === 'assistant' && data.content) {
              assistantContent += data.content;
              const updates: Partial<Message> = { content: assistantContent };
              if (streamSessionId) updates.sessionId = streamSessionId;
              updateMessageInTree(assistantMsgId, updates);
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

      // Final refresh
      fetchSessions();

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

  const handleRetry = (messageIndex: number, mode: 'once' | 'session') => {
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
    if (mode === 'session') {
      setApprovalMode('auto');
    }

    handleSendMessage(userMsg.content, {
      forceApproval: true,
      parentId: parentId || undefined
    });
  };

  const handleConfirm = async (approved: boolean) => {
    if (!confirmation) return;

    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: confirmation.correlationId,
          confirmed: approved
        })
      });
      setConfirmation(null);
    } catch (e) {
      console.error('Failed to submit confirmation', e);
    }
  };

  const handleQuestionSubmit = async (answers: any[]) => {
    if (!activeQuestion) return;

    try {
      await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: activeQuestion.correlationId,
          answers
        })
      });
      setActiveQuestion(null);
    } catch (e) {
      console.error('Failed to submit question response', e);
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

      <ConfirmDialog
        open={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDeleteSession}
        title="Delete Chat"
        description="Are you sure you want to delete this chat? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
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
            <div className="w-1/3 border-r bg-muted/10 relative">
              <ConversationGraph
                messages={graphMessages}
                currentLeafId={headId}
                onNodeClick={handleNodeClick}
              />
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
          />
        </div>
      </div>
      {confirmation && (
        <ConfirmationDialog
          details={confirmation.details}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}

      {activeQuestion && (
        <QuestionPanel
          questions={activeQuestion.questions}
          title={activeQuestion.title}
          correlationId={activeQuestion.correlationId}
          onSubmit={handleQuestionSubmit}
          onCancel={() => setActiveQuestion(null)}
        />
      )}
    </div>
  );
}
