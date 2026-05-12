'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Square, Paperclip, Image as ImageIcon, AtSign, Slash, Sparkles, ChevronDown, Zap, Code2, MessageSquare, History, RotateCcw, Copy, Hammer, Server, Puzzle, Brain, FileText, Folder, Settings, Cpu, Palette, ArchiveRestore, Shrink, ClipboardList, HelpCircle, TerminalSquare, Shield, X, User, Info, BookOpen, Layout, Laptop, Keyboard, Monitor, Key, Bug, Github, FileCode, Eye, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModelInfo } from '@/lib/pricing';
import { fetchJsonWithRetry } from '@/lib/client-fetch';
import { ModelSelector } from '@/components/layout/ModelSelector';
import { ContextTooltip } from '@/components/chat/ContextTooltip';
import { ImagePreview } from '@/components/chat/ImagePreview';
import { ModeMenu } from '@/components/chat/ModeMenu';
import { CommandSuggestions } from '@/components/chat/CommandSuggestions';
import { useChatContext } from '@/app/contexts/ChatContext';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  dataUrl: string;
}

interface ChatInputProps {
  onSend: (message: string, options?: { approvalMode?: 'safe' | 'auto'; images?: UploadedImage[]; agentName?: string }) => void;
  onStop?: () => void;
  isLoading: boolean;
  currentModel: string;
  onModelChange: (model: string) => void;
  sessionStats?: {
    totalTokens: number;
    [key: string]: number;
  };
  currentContextUsage?: number;
  mode?: 'code' | 'plan' | 'ask';
  onModeChange?: (mode: 'code' | 'plan' | 'ask') => void;
  approvalMode?: 'safe' | 'auto';
  onApprovalModeChange?: (mode: 'safe' | 'auto') => void;
  workspacePath?: string;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  onHeightChange?: (height: number) => void;
  prefillRequest?: { id: number; text: string } | null;
  compressionThreshold?: number;
  selectedAgentName?: string;
  activeRoutedAgent?: string | null;
  planStatus?: 'idle' | 'awaiting_choices' | 'review_required';
  steeringSummary?: SteeringSummary | null;
}

export interface CommandItem {
  command: string;
  description: string;
  icon: React.ElementType;
  group?: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  status: 'Enabled' | 'Disabled';
  description: string;
}

export interface MentionItem {
  path: string;
  displayPath: string;
  type: 'directory' | 'file';
}

export interface AgentItem {
  name: string;
  displayName?: string;
  description: string;
  kind: 'local' | 'remote';
  modelConfig?: {
    model?: string;
  };
}

export interface SteeringSummary {
  activeModel: string;
  activeProfile: string;
  workspaceOverrides: {
    hasModelOverride: boolean;
    hasProfileOverride: boolean;
    model: string | null;
    profile: string | null;
  };
}

export interface SkillSuggestionItem {
  id: string;
  name: string;
  description: string;
}

const BASE_COMMANDS: CommandItem[] = [
  // Chat Management
  { command: '/chat', description: 'Manage chat sessions (save, list, resume)', icon: MessageSquare, group: 'Built-in' },
  { command: '/clear', description: 'Clear conversation history', icon: Slash, group: 'Built-in' },
  { command: '/doctor', description: 'Run local diagnostics report', icon: HelpCircle, group: 'Built-in' },
  { command: '/cost', description: 'Show session and global token/cost usage', icon: Cpu, group: 'Built-in' },
  { command: '/analyze-project', description: 'Generate project structure report', icon: Folder, group: 'Built-in' },
  { command: '/resume', description: 'Resume previous session', icon: History, group: 'Built-in' },
  { command: '/rewind', description: 'Rewind conversation', icon: RotateCcw, group: 'Built-in' },
  { command: '/restore', description: 'Restore state', icon: ArchiveRestore, group: 'Built-in' },
  { command: '/compress', description: 'Compress context', icon: Shrink, group: 'Built-in' },
  { command: '/copy', description: 'Copy last response', icon: Copy, group: 'Built-in' },

  // Tools & MCP
  { command: '/tools', description: 'Manage tools', icon: Hammer, group: 'Built-in' },
  { command: '/mcp', description: 'Manage MCP servers', icon: Server, group: 'Built-in' },

  // Skills & Extensions
  { command: '/skills', description: 'Manage skills', icon: Sparkles, group: 'Built-in' },
  { command: '/extensions', description: 'Manage extensions', icon: Puzzle, group: 'Built-in' },

  // Context & Memory
  { command: '/memory', description: 'Manage memory/context', icon: Brain, group: 'Built-in' },
  { command: '/init', description: 'Initialize GEMINI.md', icon: FileText, group: 'Built-in' },
  { command: '/directory', description: 'Manage working directories', icon: Folder, group: 'Built-in' },

  // Settings
  { command: '/settings', description: 'Open settings', icon: Settings, group: 'Built-in' },
  { command: '/model', description: 'Select model', icon: Cpu, group: 'Built-in' },
  { command: '/theme', description: 'Change theme', icon: Palette, group: 'Built-in' },
  { command: '/editor', description: 'Toggle editor mode', icon: Layout, group: 'Built-in' },
  { command: '/vim', description: 'Toggle Vim mode', icon: Keyboard, group: 'Built-in' },
  { command: '/shells', description: 'Show configured shells', icon: TerminalSquare, group: 'Built-in' },
  { command: '/terminal-setup', description: 'Open terminal settings', icon: Settings, group: 'Built-in' },
  { command: '/ide', description: 'IDE integration settings', icon: Monitor, group: 'Built-in' },
  { command: '/auth', description: 'Manage authentication', icon: Key, group: 'Built-in' },
  { command: '/bug', description: 'Report a bug', icon: Bug, group: 'Built-in' },
  { command: '/setup-github', description: 'Setup GitHub integration', icon: Github, group: 'Built-in' },
  { command: '/policies', description: 'Show security policies', icon: Shield, group: 'Built-in' },
  { command: '/privacy', description: 'Show privacy settings', icon: Eye, group: 'Built-in' },
  { command: '/quit', description: 'Quit application', icon: LogOut, group: 'Built-in' },
  { command: '/about', description: 'Show GGBond information', icon: Info, group: 'Built-in' },
  { command: '/docs', description: 'Show help documentation', icon: BookOpen, group: 'Built-in' },
];


const GENERALIST_KEYWORD_PATTERN = /\b(plan|analyze|investigate|compare|refactor|architecture|workflow|multi-step|complex)\b/i;

function normalizeSuggestionDraft(value: string) {
  return value
    .replace(/\u200B/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const KeyboardShortcuts = React.memo(function KeyboardShortcuts() {
  const [show, setShow] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show]);

  const shortcuts = [
    { key: '⌘1-7', label: 'Switch Views' },
    { key: '⌘K', label: 'Command Palette' },
    { key: '⌘J', label: 'Toggle Terminal' },
    { key: '⌘N', label: 'New Chat' },
    { key: '⌘,', label: 'Settings' },
    { key: '⌘Enter', label: 'Send Message' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShow(!show)}
        className={cn(
          "p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
          show && "text-foreground bg-muted"
        )}
        title="Keyboard Shortcuts"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-background/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 p-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {shortcuts.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-xs px-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <kbd className="h-5 inline-flex items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground/60 text-center italic">
                Use /cmd for quick actions
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

function formatProfileLabel(profile: string) {
  if (profile === 'autoEdit') return 'Auto Edit';
  if (profile === 'yolo') return 'YOLO';
  return profile.charAt(0).toUpperCase() + profile.slice(1);
}

const INLINE_SKILL_TOKEN_MARKER = '\u200B';
const INLINE_SKILL_TOKEN_SOURCE = `([A-Za-z0-9._/\\\\-\u2011]+)${INLINE_SKILL_TOKEN_MARKER}`;
const INLINE_SKILL_COMMAND = '/skills';
const LEGACY_INLINE_SKILL_COMMAND = '/skill';
const ARTIFACT_SKILL_ID = 'web-artifacts-builder';
export const SKILL_COMMAND_PREFIX = '__skill__:';
const SKILLS_MANAGEMENT_SUBCOMMANDS = new Set([
  'list',
  'enable',
  'disable',
  'reload',
  'install',
  'uninstall',
]);

export const ChatInput = React.memo(function ChatInput({
  onSend,
  onStop,
  isLoading,
  currentModel,
  onModelChange,
  currentContextUsage,
  mode = 'code',
  onModeChange,
  approvalMode = 'safe',
  onApprovalModeChange,
  workspacePath,
  showTerminal,
  onToggleTerminal,
  onHeightChange,
  prefillRequest,
  compressionThreshold = 0.5,
  selectedAgentName,
  activeRoutedAgent,
  planStatus = 'idle',
  steeringSummary,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  useChatContext();
  const [showCommands, setShowCommands] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'/' | '@' | '#' | 'skill' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>(BASE_COMMANDS);
  const [filteredMentions, setFilteredMentions] = useState<MentionItem[]>([]);
  const [skillRecords, setSkillRecords] = useState<SkillRecord[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<SkillSuggestionItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<CommandItem[]>([]);
  const [agentRecords, setAgentRecords] = useState<AgentItem[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<AgentItem[]>([]);
  const inputRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputOverlayRef = useRef<HTMLDivElement>(null);
  const commandListRef = useRef<HTMLDivElement>(null);
  const mentionRequestCounter = useRef(0);
  const cursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [canvasEnabled, setCanvasEnabled] = useState(false);
  const [dismissedGeneralistSuggestionForDraft, setDismissedGeneralistSuggestionForDraft] = useState<string | null>(null);

  // Use explicit escape sequences for markers to prevent matching issues across environments
  const anyTokenPattern = new RegExp("(#?[A-Za-z0-9._/\\\\-\\u2011]+)\\u200B", "g");
  const inlineSkillTokenPattern = new RegExp("([A-Za-z0-9._/\\\\-\\u2011]+)\\u200B", "g");

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const selectedAgentRecord = useMemo(
    () => agentRecords.find((agent) => agent.name === selectedAgentName),
    [agentRecords, selectedAgentName]
  );
  const routedAgentRecord = useMemo(
    () => agentRecords.find((agent) => agent.name === activeRoutedAgent),
    [activeRoutedAgent, agentRecords]
  );
  const routedAgentName = activeRoutedAgent || selectedAgentName || null;
  const routedAgentRecordResolved = routedAgentRecord || selectedAgentRecord || null;
  const routedAgentDisplayName = routedAgentRecordResolved?.displayName || routedAgentName || 'Auto';
  const hasWorkspaceOverride = Boolean(
    steeringSummary?.workspaceOverrides.hasModelOverride || steeringSummary?.workspaceOverrides.hasProfileOverride
  );
  const hasAgentOverride = Boolean(routedAgentRecordResolved?.modelConfig?.model);
  const effectiveModel = routedAgentRecordResolved?.modelConfig?.model
    || (hasWorkspaceOverride ? steeringSummary?.activeModel : undefined)
    || currentModel;
  const effectiveProfile = steeringSummary?.activeProfile || 'default';

  const normalizedDraft = useMemo(() => normalizeSuggestionDraft(input), [input]);
  const hasInlineAgentMention = useMemo(() => {
    const hashAgentPattern = /(^|\s)#([A-Za-z0-9_-]+)(?:\u200B)?(\s|$)/;
    const atAgentPattern = /(^|\s)@([A-Za-z0-9_-]+)(\s|$)/;
    if (hashAgentPattern.test(input)) return true;
    const atMatch = input.match(atAgentPattern);
    if (!atMatch) return false;
    const candidateName = atMatch[2];
    return agentRecords.some((agent) => agent.name.toLowerCase() === candidateName.toLowerCase());
  }, [agentRecords, input]);
  const generalistSuggestionSignature = useMemo(() => {
    const sentenceSeparators = normalizedDraft.match(/[.!?;:\n]/g)?.length || 0;
    const looksComplex =
      normalizedDraft.includes('\n') ||
      normalizedDraft.length >= 220 ||
      sentenceSeparators >= 2 ||
      GENERALIST_KEYWORD_PATTERN.test(normalizedDraft);
    if (!looksComplex) return null;
    return normalizedDraft.slice(0, 500);
  }, [normalizedDraft]);
  const showGeneralistSuggestion = Boolean(
    generalistSuggestionSignature &&
    !isLoading &&
    !selectedAgentName &&
    !hasInlineAgentMention &&
    generalistSuggestionSignature !== dismissedGeneralistSuggestionForDraft
  );

  // Process pasted image
  const processPastedImage = useCallback((file: File): Promise<UploadedImage> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Not an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new window.Image(0, 0);
        img.onload = () => {
          resolve({
            id: crypto.randomUUID(),
            file,
            preview: dataUrl,
            dataUrl,
          });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  // Handle paste event
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      const newImages: UploadedImage[] = [];
      for (const file of imageFiles) {
        try {
          const img = await processPastedImage(file);
          newImages.push(img);
        } catch (err) {
          console.error('Failed to process image:', err);
        }
      }
      setUploadedImages(prev => [...prev, ...newImages]);
    }
  }, [processPastedImage]);

  // Handle file input change
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const img = await processPastedImage(file);
          newImages.push(img);
        } catch (err) {
          console.error('Failed to process image:', err);
        }
      }
    }
    setUploadedImages(prev => [...prev, ...newImages]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processPastedImage]);

  // Remove image
  const removeImage = useCallback((id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const shouldShowRouting = Boolean(routedAgentName);
  const statusSummaryParts = useMemo(() => {
    const parts: string[] = [];

    if (effectiveModel !== currentModel) {
      parts.push('Model override active');
    }

    if (effectiveProfile !== 'default') {
      parts.push(`Profile ${formatProfileLabel(effectiveProfile)}`);
    }

    if (hasWorkspaceOverride) {
      parts.push('Workspace override');
    }

    if (hasAgentOverride) {
      parts.push('Agent override');
    }

    if (shouldShowRouting && routedAgentDisplayName) {
      parts.push(`Agent ${routedAgentDisplayName}`);
    }

    if (mode === 'plan') {
      parts.push('Plan review');
    }

    return parts;
  }, [
    currentModel,
    effectiveModel,
    effectiveProfile,
    hasAgentOverride,
    hasWorkspaceOverride,
    mode,
    routedAgentDisplayName,
    shouldShowRouting,
  ]);
  const statusSummaryText = statusSummaryParts.join(' · ');

  // Calculate context usage - prefer real-time branch usage from currentContextUsage
  const { pricing } = getModelInfo(currentModel);
  const contextLimit = pricing.contextWindow;
  const usedTokens = Math.max(
    0,
    Math.round(
      (typeof currentContextUsage === 'number' && Number.isFinite(currentContextUsage))
        ? currentContextUsage
        : 0
    )
  );
  const contextPercent = Math.min((usedTokens / contextLimit) * 100, 100);

  // Ring calculations
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (contextPercent / 100) * circumference;

  // Helper to get current command bounds
  const getCommandBounds = (text: string, index: number) => {
    const textBefore = text.slice(0, index);
    const lastSlash = textBefore.lastIndexOf('/');

    if (lastSlash === -1) return null;

    // Check if it's a valid command start (beginning of line or preceded by whitespace)
    if (lastSlash > 0 && /\S/.test(text[lastSlash - 1])) {
      return null;
    }

    return { start: lastSlash, query: textBefore.slice(lastSlash) };
  };

  const getMentionBounds = (text: string, index: number) => {
    const textBefore = text.slice(0, index);
    const lastAt = textBefore.lastIndexOf('@');

    if (lastAt === -1) return null;
    if (lastAt > 0 && /\S/.test(text[lastAt - 1])) return null;

    const token = textBefore.slice(lastAt + 1);
    if (token.includes('\n')) return null;

    return { start: lastAt, query: token };
  };

  // Agent mention bounds (triggered by #)
  const getAgentBounds = (text: string, index: number) => {
    const textBefore = text.slice(0, index);
    const lastHash = textBefore.lastIndexOf('#');

    if (lastHash === -1) return null;
    // Must be at start of line or preceded by whitespace
    if (lastHash > 0 && /\S/.test(text[lastHash - 1])) return null;

    const token = textBefore.slice(lastHash + 1);
    if (token.includes('\n')) return null;

    return { start: lastHash, query: token };
  };

  const getSkillBounds = (text: string, index: number) => {
    const textBefore = text.slice(0, index);
    const commandMatch = textBefore.match(/(^|\s)\/skills?\s+([^\s\n]*)$/);
    if (commandMatch) {
      const rawQuery = (commandMatch[2] || '').trim();
      if (rawQuery && SKILLS_MANAGEMENT_SUBCOMMANDS.has(rawQuery.toLowerCase())) {
        return null;
      }
      const query = rawQuery.toLowerCase();
      const start = textBefore.length - commandMatch[0].length + commandMatch[1].length;
      return { query, start };
    }

    return null;
  };

  const createSkillToken = (skillId: string) => {
    // Use non-breaking hyphen to prevent wrapping inside token in textarea
    const atomicId = skillId.replace(/-/g, '\u2011');
    return `${atomicId}${INLINE_SKILL_TOKEN_MARKER}`;
  };

  const createAgentToken = (agentName: string) => {
    const atomicName = agentName.replace(/-/g, '\u2011');
    return `#${atomicName}${INLINE_SKILL_TOKEN_MARKER}`;
  };

  const getCurrentCursor = () => {
    return textareaRef.current?.selectionStart ?? cursorRef.current.start;
  };

  const getSkillTokenRangeAt = (text: string, cursor: number) => {
    const regex = new RegExp(anyTokenPattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (cursor > start && cursor < end) {
        return { start, end };
      }
    }
    return null;
  };

  const getSkillTokenRangeEndingAt = (text: string, cursor: number) => {
    const regex = new RegExp(anyTokenPattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const end = match.index + match[0].length;
      if (end === cursor) {
        return { start: match.index, end };
      }
    }
    return null;
  };

  const getSkillTokenRangeStartingAt = (text: string, cursor: number) => {
    const regex = new RegExp(anyTokenPattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (start === cursor) {
        return { start, end };
      }
    }
    return null;
  };

  const snapCursorOutsideSkillToken = (text: string, cursor: number) => {
    const range = getSkillTokenRangeAt(text, cursor);
    return range ? range.end : cursor;
  };

  const insertTokenCommand = (before: string, after: string, token: string) => {
    const normalizedBefore = before.replace(/[ \t]+$/, '');
    const normalizedAfter = after.replace(/^[ \t]+/, '');
    const needLeadingSpace = normalizedBefore.length > 0 && !/\s$/.test(normalizedBefore);
    // Keep one trailing separator so users can immediately type plain text or another /skills command.
    const needTrailingSpace = normalizedAfter.length === 0 || !/^\s/.test(normalizedAfter);

    const left = `${normalizedBefore}${needLeadingSpace ? ' ' : ''}`;
    const right = ` ${normalizedAfter}`; // Force at least one trailing space for breathing room
    const value = `${left}${token}${right}`;
    const cursor = (left + token + 1).length;
    return { value, cursor };
  };

  const insertSkillCommand = (before: string, after: string, skillId: string) => {
    return insertTokenCommand(before, after, createSkillToken(skillId));
  };

  const removeSkillTokenRange = (start: number, end: number) => {
    const before = input.slice(0, start);
    let after = input.slice(end);
    if (before.endsWith(' ') && after.startsWith(' ')) {
      after = after.slice(1);
    }

    const nextValue = before + after;
    const nextCursor = before.length;
    setInput(nextValue);
    setCursorPosition(nextCursor);
    cursorRef.current = { start: nextCursor, end: nextCursor };
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
    void updateSuggestions(nextValue, nextCursor);
  };

  useEffect(() => {
    // Scroll selected item into view
    if (showCommands && commandListRef.current) {
      const selectedElement = commandListRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showCommands]);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const { response, data } = await fetchJsonWithRetry<SkillRecord[]>('/api/skills');
        if (!response.ok) return;

        const skills: SkillRecord[] = data;
        setSkillRecords(skills);
        const skillCommands = skills
          .filter((skill) => skill.status === 'Enabled')
          .map((skill) => ({
            command: `${SKILL_COMMAND_PREFIX}${skill.id}`,
            description: skill.description || `Use ${skill.name} skill`,
            icon: Sparkles,
            group: 'Skills'
          }));
        setInstalledSkills(skillCommands);
      } catch (error) {
        console.error('Failed to fetch skills for autocomplete', error);
      }
    };

    const fetchAgents = async () => {
      try {
        const { response, data } = await fetchJsonWithRetry<{ agents?: AgentItem[] }>('/api/agents');
        if (!response.ok) return;
        setAgentRecords(data.agents || []);
      } catch (error) {
        console.error('Failed to fetch agents for autocomplete', error);
      }
    };

    const refreshRegistry = () => {
      void fetchSkills();
      void fetchAgents();
    };

    refreshRegistry();
    window.addEventListener('focus', refreshRegistry);
    return () => window.removeEventListener('focus', refreshRegistry);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ggbond-canvas-enabled');
      if (saved === '1') {
        setCanvasEnabled(true);
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ggbond-canvas-enabled', canvasEnabled ? '1' : '0');
    } catch {
      // Ignore localStorage failures.
    }
  }, [canvasEnabled]);

  useEffect(() => {
    if (isLoading) {
      setIsSending(false);
    }
  }, [isLoading]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [input]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    if (!prefillRequest) return;

    const nextValue = prefillRequest.text || '';
    const nextCursor = nextValue.length;
    setInput(nextValue);
    inputRef.current = nextValue;
    setCursorPosition(nextCursor);
    cursorRef.current = { start: nextCursor, end: nextCursor };

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
    void updateSuggestions(nextValue, nextCursor);
  }, [prefillRequest?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ skillId?: string }>;
      const skillId = customEvent.detail?.skillId;
      if (!skillId) return;

      const prev = inputRef.current;
      const isFocused = document.activeElement === textareaRef.current;
      const start = isFocused
        ? (textareaRef.current?.selectionStart ?? prev.length)
        : prev.length;
      const end = isFocused
        ? (textareaRef.current?.selectionEnd ?? prev.length)
        : prev.length;
      const safeStart = Math.max(0, Math.min(start, prev.length));
      const safeEnd = Math.max(safeStart, Math.min(end, prev.length));
      const before = prev.slice(0, safeStart);
      const after = prev.slice(safeEnd);
      const { value: nextValue, cursor: nextCursorPos } = insertSkillCommand(before, after, skillId);

      inputRef.current = nextValue;
      setInput(nextValue);
      setCursorPosition(nextCursorPos);
      cursorRef.current = { start: nextCursorPos, end: nextCursorPos };
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
        }
      });
    };

    const agentHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ agentName?: string }>;
      const agentName = customEvent.detail?.agentName;
      if (!agentName) return;

      const prev = inputRef.current;
      const isFocused = document.activeElement === textareaRef.current;
      const start = isFocused
        ? (textareaRef.current?.selectionStart ?? prev.length)
        : prev.length;
      const end = isFocused
        ? (textareaRef.current?.selectionEnd ?? prev.length)
        : prev.length;

      const safeStart = Math.max(0, Math.min(start, prev.length));
      const safeEnd = Math.max(safeStart, Math.min(end, prev.length));
      const before = prev.slice(0, safeStart);
      const after = prev.slice(safeEnd);

      const token = createAgentToken(agentName);
      const { value: nextValue, cursor: nextCursorPos } = insertTokenCommand(before, after, token);

      inputRef.current = nextValue;
      setInput(nextValue);
      setCursorPosition(nextCursorPos);
      cursorRef.current = { start: nextCursorPos, end: nextCursorPos };
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
        }
      });
    };

    window.addEventListener('insert-skill-token', handler as EventListener);
    window.addEventListener('insert-agent-token', agentHandler as EventListener);
    return () => {
      window.removeEventListener('insert-skill-token', handler as EventListener);
      window.removeEventListener('insert-agent-token', agentHandler as EventListener);
    };
  }, []);

  const updateSuggestions = async (value: string, cursorIndex: number) => {
    const skillBounds = getSkillBounds(value, cursorIndex);
    if (skillBounds) {
      const candidates = skillRecords
        .filter((skill) => skill.status === 'Enabled')
        .filter((skill) => {
          if (!skillBounds.query) return true;
          return (
            skill.id.toLowerCase().includes(skillBounds.query) ||
            skill.name.toLowerCase().includes(skillBounds.query) ||
            (skill.description || '').toLowerCase().includes(skillBounds.query)
          );
        })
        .slice(0, 50)
        .map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description || `Use ${skill.name} skill`,
        }));

      if (candidates.length > 0) {
        setFilteredSkills(candidates);
        setActiveTrigger('skill');
        setShowCommands(true);
        setSelectedIndex(0);
      } else {
        setFilteredSkills([]);
        setActiveTrigger(null);
        setShowCommands(false);
      }
      return;
    }

    const bounds = getCommandBounds(value, cursorIndex);

    if (bounds) {
      const search = bounds.query.toLowerCase();

      // Combine base commands and skills
      const allCommands = [...BASE_COMMANDS, ...installedSkills];

      const searchWithoutSlash = search.replace(/^\//, '');
      const matches = allCommands.filter(c => {
        if (c.command.startsWith(SKILL_COMMAND_PREFIX)) {
          // For skill items, match against skill ID and description
          const skillId = c.command.slice(SKILL_COMMAND_PREFIX.length).toLowerCase();
          if (search === '/') return true; // Show all skills when just typing /
          return skillId.includes(searchWithoutSlash) ||
            c.description.toLowerCase().includes(searchWithoutSlash);
        }
        return c.command.toLowerCase().startsWith(search) ||
          (search.length > 1 && c.description.toLowerCase().includes(searchWithoutSlash));
      });

      // Sort: Built-in first, then Skills
      matches.sort((a, b) => {
        if (a.group === b.group) return 0;
        return a.group === 'Built-in' ? -1 : 1;
      });

      if (matches.length > 0) {
        setFilteredCommands(matches);
        setActiveTrigger('/');
        setShowCommands(true);
        setSelectedIndex(0);
      } else {
        setActiveTrigger(null);
        setShowCommands(false);
      }
      return;
    }

    const mentionBounds = getMentionBounds(value, cursorIndex);
    if (mentionBounds) {
      const workspace = workspacePath?.trim();
      if (!workspace) {
        setFilteredMentions([]);
        setActiveTrigger(null);
        setShowCommands(false);
        return;
      }

      const reqId = ++mentionRequestCounter.current;
      const query = mentionBounds.query;
      const params = new URLSearchParams({
        index: '1',
        mentions: '1',
        limit: '120',
        q: query,
      });
      params.set('path', workspace);

      try {
        const res = await fetch(`/api/files?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch file index');
        }
        const data = await res.json();
        if (reqId !== mentionRequestCounter.current) {
          return;
        }
        const basePath = typeof data.path === 'string' ? data.path : (workspacePath || '');
        const mentions: MentionItem[] = Array.isArray(data.files)
          ? data.files.map((entry: { path: string; type: 'directory' | 'file' }) => {
            const absPath = entry.path || '';
            const relPath = basePath && absPath.startsWith(basePath)
              ? absPath.slice(basePath.length).replace(/^\/+/, '')
              : absPath;
            return {
              path: relPath || absPath,
              displayPath: relPath || absPath,
              type: entry.type || 'file'
            };
          })
          : [];

        if (mentions.length > 0) {
          setFilteredMentions(mentions);
          setActiveTrigger('@');
          setShowCommands(true);
          setSelectedIndex(0);
        } else {
          setFilteredMentions([]);
          setActiveTrigger(null);
          setShowCommands(false);
        }
      } catch (error) {
        console.error('Failed to index workspace files for @ autocomplete', error);
        setFilteredMentions([]);
        setActiveTrigger(null);
        setShowCommands(false);
      }
      return;
    }

    // Handle # for agent mentions
    const agentBounds = getAgentBounds(value, cursorIndex);
    if (agentBounds) {
      const query = agentBounds.query.toLowerCase();
      const candidates = agentRecords.filter((agent) => {
        if (!query) return true;
        return (
          agent.name.toLowerCase().includes(query) ||
          (agent.displayName || '').toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query)
        );
      }).slice(0, 50);

      if (candidates.length > 0) {
        setFilteredAgents(candidates);
        setActiveTrigger('#');
        setShowCommands(true);
        setSelectedIndex(0);
      } else {
        setFilteredAgents([]);
        setActiveTrigger(null);
        setShowCommands(false);
      }
      return;
    }

    setActiveTrigger(null);
    setShowCommands(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const rawCursorPos = e.target.selectionStart;
    const newCursorPos = snapCursorOutsideSkillToken(value, rawCursorPos);
    setInput(value);
    setCursorPosition(newCursorPos);
    cursorRef.current = { start: newCursorPos, end: newCursorPos };
    if (newCursorPos !== rawCursorPos) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    }
    void updateSuggestions(value, newCursorPos);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const snapped = snapCursorOutsideSkillToken(target.value, target.selectionStart);
    setCursorPosition(snapped);
    cursorRef.current = { start: snapped, end: snapped };
    if (snapped !== target.selectionStart) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(snapped, snapped);
        }
      });
    }
    void updateSuggestions(target.value, snapped);
  };

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (inputOverlayRef.current) {
      inputOverlayRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cursor = textareaRef.current?.selectionStart ?? cursorPosition;
    const tokenRange = getSkillTokenRangeAt(input, cursor);
    const backspaceBoundaryRange = e.key === 'Backspace' ? getSkillTokenRangeEndingAt(input, cursor) : null;
    const deleteBoundaryRange = e.key === 'Delete' ? getSkillTokenRangeStartingAt(input, cursor) : null;
    const activeTokenRange = tokenRange || backspaceBoundaryRange || deleteBoundaryRange;
    if (activeTokenRange) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const nextValue = input.slice(0, activeTokenRange.start) + input.slice(activeTokenRange.end);
        setInput(nextValue);
        setCursorPosition(activeTokenRange.start);
        cursorRef.current = { start: activeTokenRange.start, end: activeTokenRange.start };
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(activeTokenRange.start, activeTokenRange.start);
          }
        });
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        const nextValue =
          input.slice(0, activeTokenRange.end) +
          e.key +
          input.slice(activeTokenRange.end);
        const nextCursor = activeTokenRange.end + 1;
        setInput(nextValue);
        setCursorPosition(nextCursor);
        cursorRef.current = { start: nextCursor, end: nextCursor };
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(nextCursor, nextCursor);
          }
        });
        void updateSuggestions(nextValue, nextCursor);
        return;
      }
    }

    const finalSuggestionCount =
      activeTrigger === '/'
        ? filteredCommands.length
        : activeTrigger === '@'
          ? filteredMentions.length
          : activeTrigger === '#'
            ? filteredAgents.length
            : filteredSkills.length;

    if (showCommands && finalSuggestionCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % finalSuggestionCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + finalSuggestionCount) % finalSuggestionCount);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (activeTrigger === '/') {
          const cmd = filteredCommands[selectedIndex];
          if (cmd) handleCommandSelect(cmd.command);
        } else if (activeTrigger === '@') {
          const mention = filteredMentions[selectedIndex];
          if (mention) handleMentionSelect(mention.path);
        } else if (activeTrigger === 'skill') {
          const skill = filteredSkills[selectedIndex];
          if (skill) handleSkillSelect(skill.id);
        } else if (activeTrigger === '#') {
          const agent = filteredAgents[selectedIndex];
          if (agent) handleAgentSelect(agent.name);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
  };

  const handleCommandSelect = (cmd: string) => {
    const cursor = getCurrentCursor();
    const bounds = getCommandBounds(input, cursor);
    if (!bounds) return;

    const { start } = bounds;

    const textBefore = input.slice(0, start);
    const textAfter = input.slice(cursor);

    // Find end of current word (if any, e.g. replacing a partial command)
    let end = 0;
    while (end < textAfter.length && /\S/.test(textAfter[end])) {
      end++;
    }
    const suffix = textAfter.slice(end);

    if (cmd.startsWith(SKILL_COMMAND_PREFIX)) {
      const skillId = cmd.slice(SKILL_COMMAND_PREFIX.length);
      const { value: newValue, cursor: newCursorPos } = insertSkillCommand(textBefore, suffix, skillId);
      setInput(newValue);
      setCursorPosition(newCursorPos);
      cursorRef.current = { start: newCursorPos, end: newCursorPos };
      setShowCommands(false);
      setActiveTrigger(null);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          cursorRef.current = { start: newCursorPos, end: newCursorPos };
        }
      }, 0);
      return;
    }

    if (cmd.startsWith(`${INLINE_SKILL_COMMAND} `) || cmd.startsWith(`${LEGACY_INLINE_SKILL_COMMAND} `)) {
      const skillId = cmd
        .replace(`${INLINE_SKILL_COMMAND} `, '')
        .replace(`${LEGACY_INLINE_SKILL_COMMAND} `, '')
        .trim();
      const { value: newValue, cursor: newCursorPos } = insertSkillCommand(textBefore, suffix, skillId);
      setInput(newValue);
      setCursorPosition(newCursorPos);
      cursorRef.current = { start: newCursorPos, end: newCursorPos };
      setShowCommands(false);
      setActiveTrigger(null);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          cursorRef.current = { start: newCursorPos, end: newCursorPos };
        }
      }, 0);
      return;
    }

    const newValue = textBefore + cmd + ' ' + suffix;
    setInput(newValue);

    const newCursorPos = start + cmd.length + 1;
    setCursorPosition(newCursorPos);
    cursorRef.current = { start: newCursorPos, end: newCursorPos };

    setShowCommands(false);
    setActiveTrigger(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        cursorRef.current = { start: newCursorPos, end: newCursorPos };
      }
    }, 0);
  };

  const handleMentionSelect = (mentionPath: string) => {
    const cursor = getCurrentCursor();
    const bounds = getMentionBounds(input, cursor);
    if (!bounds) return;

    const { start } = bounds;
    const textBefore = input.slice(0, start);
    const textAfter = input.slice(cursor);

    let end = 0;
    while (end < textAfter.length && /\S/.test(textAfter[end])) {
      end++;
    }
    const suffix = textAfter.slice(end);

    const mention = `@${mentionPath}`;
    const newValue = textBefore + mention + ' ' + suffix;
    setInput(newValue);
    setShowCommands(false);
    setActiveTrigger(null);

    const newCursorPos = start + mention.length + 1;
    setCursorPosition(newCursorPos);
    cursorRef.current = { start: newCursorPos, end: newCursorPos };
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        cursorRef.current = { start: newCursorPos, end: newCursorPos };
      }
    }, 0);
  };

  const handleAgentSelect = (agentName: string) => {
    const cursor = getCurrentCursor();
    const bounds = getAgentBounds(input, cursor);
    if (!bounds) {
      const event = new CustomEvent('insert-agent-token', {
        detail: { agentName }
      });
      window.dispatchEvent(event);
      return;
    }

    const { start } = bounds;
    const textBefore = input.slice(0, start);
    const textAfter = input.slice(cursor);

    let end = 0;
    while (end < textAfter.length && /\S/.test(textAfter[end])) {
      end++;
    }
    const suffix = textAfter.slice(end);

    const { value: newValue, cursor: newCursorPos } = insertTokenCommand(textBefore, suffix, createAgentToken(agentName));
    setInput(newValue);
    setShowCommands(false);
    setActiveTrigger(null);

    setCursorPosition(newCursorPos);
    cursorRef.current = { start: newCursorPos, end: newCursorPos };
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        cursorRef.current = { start: newCursorPos, end: newCursorPos };
      }
    }, 0);
  };

  const handleUseGeneralistSuggestion = () => {
    handleAgentSelect('generalist-agent');
    if (generalistSuggestionSignature) {
      setDismissedGeneralistSuggestionForDraft(generalistSuggestionSignature);
    }
  };

  const handleDismissGeneralistSuggestion = () => {
    if (generalistSuggestionSignature) {
      setDismissedGeneralistSuggestionForDraft(generalistSuggestionSignature);
    }
  };

  const handleSkillSelect = (skillId: string) => {
    const cursor = getCurrentCursor();
    const bounds = getSkillBounds(input, cursor);
    if (!bounds) return;

    const textBefore = input.slice(0, bounds.start);
    const textAfter = input.slice(cursor);
    let end = 0;
    while (end < textAfter.length && /\S/.test(textAfter[end])) {
      end++;
    }
    const suffix = textAfter.slice(end);
    const { value: nextValue, cursor: newCursorPos } = insertSkillCommand(textBefore, suffix, skillId);

    setInput(nextValue);
    setCursorPosition(newCursorPos);
    cursorRef.current = { start: newCursorPos, end: newCursorPos };
    setShowCommands(false);
    setActiveTrigger(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        cursorRef.current = { start: newCursorPos, end: newCursorPos };
      }
    }, 0);
  };

  const handleSend = () => {
    // Always allow sending - parent component will handle queue logic if AI is busy

    // Extract agent mention (#agent-name or @agent-name) before any other processing
    // #agent-name is always treated as an agent reference.
    // @agent-name is treated as an agent reference ONLY if it matches a known agent name
    // (to avoid conflicts with @file-path mentions).
    const hashAgentPattern = /(^|\s)#([A-Za-z0-9_-]+)(?:\u200B)?(\s|$)/;
    const atAgentPattern = /(^|\s)@([A-Za-z0-9_-]+)(\s|$)/;
    const hashMatch = input.match(hashAgentPattern);
    let inlineAgentName: string | undefined;
    let agentRemovePattern: RegExp | undefined;

    if (hashMatch) {
      inlineAgentName = hashMatch[2];
      agentRemovePattern = hashAgentPattern;
    } else {
      const atMatch = input.match(atAgentPattern);
      if (atMatch) {
        const candidateName = atMatch[2];
        // Only treat as agent if it matches a known agent name
        const isKnownAgent = agentRecords.some(
          (a) => a.name.toLowerCase() === candidateName.toLowerCase()
        );
        if (isKnownAgent) {
          inlineAgentName = candidateName;
          agentRemovePattern = atAgentPattern;
        }
      }
    }

    // Remove agent mention from input for further processing
    const inputWithoutAgent = (inlineAgentName && agentRemovePattern)
      ? input.replace(agentRemovePattern, '$1$3').replace(/\u200B/g, '').replace(/[ \t]{2,}/g, ' ').trim()
      : input.replace(/\u200B/g, '');

    const typedSkillPattern = /(\/skills?)\s+([A-Za-z0-9._/-]+)(?=\s|$)/g;
    const inlineTokenRegex = new RegExp(inlineSkillTokenPattern.source, 'g');
    const typedSkillMatches = Array.from(inputWithoutAgent.matchAll(typedSkillPattern));
    const tokenSkillIds = Array.from(
      inputWithoutAgent.matchAll(inlineTokenRegex)
    ).map((m) => m[1]);
    const typedSkillIds = typedSkillMatches
      .map((m) => m[2])
      .filter((id) => !SKILLS_MANAGEMENT_SUBCOMMANDS.has(id.toLowerCase()));
    const mergedSkillIds = Array.from(new Set([...tokenSkillIds, ...typedSkillIds]));

    // Keep inline skill ids in the sentence when the user wrote surrounding text
    // (e.g. "你会不会用 <skillA> 和 <skillB>"), but keep old behavior for skill-only sends.
    const hasNonSkillText = inputWithoutAgent
      .replace(inlineTokenRegex, '')
      .replace(typedSkillPattern, (full, _command, id) => (
        SKILLS_MANAGEMENT_SUBCOMMANDS.has(String(id).toLowerCase()) ? full : ''
      ))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim().length > 0;

    const cleanedInput = inputWithoutAgent
      .replace(inlineTokenRegex, (_full, id) => (hasNonSkillText ? String(id) : ''))
      .replace(typedSkillPattern, (full, _command, id) => (
        SKILLS_MANAGEMENT_SUBCOMMANDS.has(String(id).toLowerCase()) ? full : ''
      ))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedInput && mergedSkillIds.length === 0) return;

    const isExplicitSlashCommand = cleanedInput.startsWith('/');
    const finalSkillIds = (!isExplicitSlashCommand && canvasEnabled)
      ? Array.from(new Set([...mergedSkillIds, ARTIFACT_SKILL_ID]))
      : mergedSkillIds;
    const skillPrefix = finalSkillIds.map((id) => `${INLINE_SKILL_COMMAND} ${id}`).join('\n');
    const artifactInstruction = (!isExplicitSlashCommand && canvasEnabled)
      ? 'Artifact mode: force artifact output. Generate a runnable single-file HTML artifact and provide the output .html path in your response.'
      : '';
    const bodyWithCanvas = [artifactInstruction, cleanedInput].filter(Boolean).join('\n');
    const finalMessage = skillPrefix
      ? `${skillPrefix}${bodyWithCanvas ? `\n${bodyWithCanvas}` : ''}`
      : bodyWithCanvas;

    setIsSending(true);
    setTimeout(() => setIsSending(false), 800);

    onSend(finalMessage.replace(/\u2011/g, '-'), { approvalMode: currentApprovalMode, images: uploadedImages, agentName: inlineAgentName });
    setInput('');
    setUploadedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const renderInlineTokens = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    // Match both skills ([...] marker) and agents (#... marker)
    const regex = new RegExp(anyTokenPattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="pointer-events-none">{input.slice(lastIndex, match.index)}</span>
        );
      }

      const fullToken = match[0];
      const content = match[1].replace(/\u2011/g, '-');
      const isAgent = content.startsWith('#');
      const id = isAgent ? content.slice(1) : content;

      const tokenStart = match.index;
      const tokenEnd = match.index + match[0].length;

      parts.push(
        <span
          key={`${isAgent ? 'agent' : 'skill'}-${match.index}-${id}`}
          className={cn(
            "pointer-events-auto relative inline-flex align-baseline",
            isAgent ? "group/agent" : "group/skill"
          )}
        >
          {/* Visual Badge perfectly constrained by textarea natural text width */}
          <span className={cn(
            "relative select-none z-0 hover:z-10 transition-colors duration-200",
            // We replicate the exact style of SkillBadge.tsx but use box-shadow 
            // for horizontal padding to protect textarea cursor mapping.
            // Using outline instead of border entirely avoids layout width expansion.
            "rounded shadow-[0_0_0_1px]",
            "outline outline-1 outline-offset-[1px]",
            isAgent
              ? "bg-blue-100 text-blue-900 shadow-blue-100 outline-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:shadow-blue-900/40 dark:outline-blue-700/50"
              : "bg-violet-100 text-violet-900 shadow-violet-100 outline-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:shadow-violet-900/40 dark:outline-violet-700/50"
          )}>
            {/* Remove any vertical padding or inline-block so it doesn't artificially expand line height and overlap text below */}
            <span className="whitespace-pre-wrap relative z-10">{fullToken}</span>
          </span>

          {/* Close Button - Brought inward so it doesn't get clipped by the overflow-y-auto wrapper */}
          <button
            type="button"
            className={cn(
              "absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-slate-800/90 text-white border border-white/20 shadow-sm opacity-0 flex items-center justify-center hover:bg-slate-950 transition-colors duration-200 z-20",
              isAgent ? "group-hover/agent:opacity-100" : "group-hover/skill:opacity-100"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeSkillTokenRange(tokenStart, tokenEnd);
            }}
            aria-label={`Remove ${isAgent ? 'agent' : 'skill'} ${id}`}
          >
            <X className="w-2 h-2 stroke-[3px]" />
          </button>
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
      parts.push(<span key={`text-tail`} className="pointer-events-none">{input.slice(lastIndex)}</span>);
    }

    return parts;
  };

  const [currentApprovalMode, setCurrentApprovalMode] = useState<'safe' | 'auto'>(approvalMode);

  useEffect(() => {
    setCurrentApprovalMode(approvalMode);
  }, [approvalMode]);

  useEffect(() => {
    onApprovalModeChange?.(currentApprovalMode);
  }, [currentApprovalMode, onApprovalModeChange]);

  // Keyboard shortcuts for mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + number key
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          onModeChange?.('code');
        } else if (e.key === '2') {
          e.preventDefault();
          onModeChange?.('plan');
        } else if (e.key === '3') {
          e.preventDefault();
          onModeChange?.('ask');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange]);

  useEffect(() => {
    if (!onHeightChange) return;
    const el = containerRef.current;
    if (!el) return;

    const notify = () => {
      onHeightChange(Math.ceil(el.getBoundingClientRect().height));
    };

    notify();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => notify());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', notify);
    return () => window.removeEventListener('resize', notify);
  }, [onHeightChange]);


  return (
    <div ref={containerRef} className="p-4 bg-background border-t relative">
      <div className="max-w-3xl mx-auto relative">
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Image preview area */}
        <ImagePreview images={uploadedImages} onRemove={removeImage} />

        {/* Command Suggestions */}
        {showCommands && (
          <CommandSuggestions
            activeTrigger={activeTrigger}
            filteredCommands={filteredCommands}
            filteredMentions={filteredMentions}
            filteredSkills={filteredSkills}
            filteredAgents={filteredAgents}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            handleCommandSelect={handleCommandSelect}
            handleMentionSelect={handleMentionSelect}
            handleSkillSelect={handleSkillSelect}
            handleAgentSelect={handleAgentSelect}
            commandListRef={commandListRef}
          />
        )}

        <div className={cn(
          "group/chipwrap relative flex flex-col gap-2 p-2 rounded-xl border bg-secondary transition-colors duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <div className="relative min-h-[40px] max-h-[200px]">
            {input.length === 0 && (
              <div className="pointer-events-none absolute inset-0 px-2 py-1 text-sm text-muted-foreground/60 z-20">
                Ask anything…
              </div>
            )}

            {/* 1. Underlying Textarea (Input Layer) - z-0 */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onSelect={handleSelect}
              onScroll={handleTextareaScroll}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder=""
              className="absolute inset-0 w-full h-full bg-transparent border-none focus:outline-none resize-none text-transparent caret-foreground selection:bg-primary/20 font-sans text-sm leading-relaxed px-2 py-1 z-0"
              rows={1}
              style={{ minHeight: '40px' }}
            />

            {/* 2. Overlay (Visual Layer) - z-10, pointer-events-none */}
            <div
              ref={inputOverlayRef}
              aria-hidden
              className="relative z-10 pointer-events-none whitespace-pre-wrap break-words font-sans px-2 py-1 text-sm leading-relaxed min-h-[40px] max-h-[200px] overflow-y-auto"
            >
              {renderInlineTokens()}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 relative">
              {/* Hint badges — shows available triggers persistently */}
              {!input.trim() && (
                <div className="flex items-center gap-1 mr-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/50 border border-border/30 leading-none">/ cmd</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/50 border border-border/30 leading-none">@ file</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground/50 border border-border/30 leading-none"># agent</span>
                </div>
              )}
              {/* Model Selector */}
              <ModelSelector
                value={currentModel}
                onChange={onModelChange}
                variant="inline"
              />

              <div className="w-px h-4 bg-border mx-1" />

              {/* Mode Selector */}
              <ModeMenu mode={mode} onChange={onModeChange} />

              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={() => setCanvasEnabled((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                  canvasEnabled
                    ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/15"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
                title={canvasEnabled ? "Artifact mode enabled (click to disable)" : "Enable Artifact mode (force specialized output format)"}
              >
                <span className="font-medium">Artifact</span>
                {canvasEnabled && <X className="w-3 h-3 opacity-80" />}
              </button>

              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
                title="Add Image"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                Cmd+Enter
              </span>
              <KeyboardShortcuts />
              {isLoading || isSending ? (
                <button
                  onClick={onStop}
                  disabled={!onStop && !isSending}
                  aria-label={isSending ? "Sending..." : "Stop"}
                  className={cn(
                    "group/stopbtn h-8 w-8 rounded-full transition-colors duration-200 inline-flex items-center justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                    isSending
                      ? "bg-primary text-primary-foreground opacity-90 cursor-wait"
                      : onStop
                        ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isSending ? (
                    <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span className="absolute bottom-full mb-2 px-2 py-1 bg-card text-foreground text-xs rounded-md shadow-md opacity-0 invisible group-hover/stopbtn:opacity-100 group-hover/stopbtn:visible transition-colors whitespace-nowrap z-50 border border-border">
                    {isSending ? "Sending message..." : "Stop response"}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label="Send"
                  className={cn(
                    "group/sendbtn h-8 w-8 rounded-full transition-colors duration-200 inline-flex items-center justify-center relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                    input.trim()
                      ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="absolute bottom-full mb-2 px-2 py-1 bg-card text-foreground text-xs rounded-md shadow-md opacity-0 invisible group-hover/sendbtn:opacity-100 group-hover/sendbtn:visible transition-colors whitespace-nowrap z-50 border border-border">
                    Send message
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 px-1">
          {showGeneralistSuggestion && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>This looks multi-step. Route with Generalist Agent?</span>
              </div>
              <button
                type="button"
                onClick={handleUseGeneralistSuggestion}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                Use Generalist
              </button>
              <button
                type="button"
                onClick={handleDismissGeneralistSuggestion}
                className="rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ContextTooltip
              usedTokens={usedTokens}
              contextLimit={contextLimit}
              contextPercent={contextPercent}
              currentModel={currentModel}
              compressionThreshold={compressionThreshold}
              circumference={circumference}
              strokeDashoffset={strokeDashoffset}
              radius={radius}
            />

            {/* Approval Mode Toggle */}
            <button
              onClick={() => {
                const nextMode = currentApprovalMode === 'safe' ? 'auto' : 'safe';
                setCurrentApprovalMode(nextMode);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 h-[28px] w-[84px] text-[11px] font-bold rounded-lg transition-colors duration-300 relative z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                currentApprovalMode === 'auto'
                  ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 ring-1 ring-orange-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={currentApprovalMode === 'auto' ? "Auto Mode: All tool calls are allowed" : "Safe Mode: Ask for approval"}
            >
              {currentApprovalMode === 'auto' ? (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current animate-pulse shrink-0" />
                  <span>Auto Mode</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span>Safe Mode</span>
                </>
              )}
            </button>

            {statusSummaryText && (
              <p className="px-1 text-[11px] leading-4 text-muted-foreground/75">
                {statusSummaryText}
              </p>
            )}
          </div>

          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 px-3 h-[28px] rounded-lg text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0",
                showTerminal
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={showTerminal ? "Hide terminal panel" : "Show terminal panel"}
            >
              <TerminalSquare className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
