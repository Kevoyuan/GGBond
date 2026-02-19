import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Send, Square, Paperclip, Image as ImageIcon, AtSign, Slash, Sparkles, ChevronDown, Zap, Code2, RefreshCw, MessageSquare, History, RotateCcw, Copy, Hammer, Server, Puzzle, Brain, FileText, Folder, Settings, Cpu, Palette, ArchiveRestore, Shrink, ClipboardList, HelpCircle, TerminalSquare, Shield, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModelInfo } from '@/lib/pricing';
import { AnimatePresence, motion } from 'framer-motion';
import { ModelSelector } from './ModelSelector';

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
}

interface CommandItem {
  command: string;
  description: string;
  icon: React.ElementType;
  group?: string;
}

interface SkillRecord {
  id: string;
  name: string;
  status: 'Enabled' | 'Disabled';
  description: string;
}

interface MentionItem {
  path: string;
  displayPath: string;
  type: 'directory' | 'file';
}

interface AgentItem {
  name: string;
  displayName?: string;
  description: string;
  kind: 'local' | 'remote';
}

interface SkillSuggestionItem {
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
];

interface ModeOption {
  value: 'code' | 'plan' | 'ask';
  label: string;
  icon: React.ElementType;
  description: string;
  shortcut?: string;
  color: string;
  bgColor: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'code', label: 'Code', icon: Code2, description: 'Read/Write files & Execute commands', shortcut: 'Ctrl+1', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { value: 'plan', label: 'Plan', icon: ClipboardList, description: 'Analyze & Plan, no execution', shortcut: 'Ctrl+2', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { value: 'ask', label: 'Ask', icon: HelpCircle, description: 'Answer questions only', shortcut: 'Ctrl+3', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
];


const INLINE_SKILL_TOKEN_MARKER = '\u200B';
const INLINE_SKILL_TOKEN_SOURCE = `([A-Za-z0-9._/\\-\u2011]+)${INLINE_SKILL_TOKEN_MARKER}`;
const INLINE_SKILL_COMMAND = '/skills';
const LEGACY_INLINE_SKILL_COMMAND = '/skill';
const SKILLS_MANAGEMENT_SUBCOMMANDS = new Set([
  'list',
  'enable',
  'disable',
  'reload',
  'install',
  'uninstall',
]);

export const ChatInput = React.memo(function ChatInput({ onSend, onStop, isLoading, currentModel, onModelChange, sessionStats, currentContextUsage, mode = 'code', onModeChange, approvalMode = 'safe', onApprovalModeChange, workspacePath, showTerminal, onToggleTerminal, onHeightChange, prefillRequest, compressionThreshold = 0.5 }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'/' | '@' | '#' | 'skill' | null>(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
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
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const mentionRequestCounter = useRef(0);
  const cursorRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showContextTooltip, setShowContextTooltip] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Use explicit escape sequences for markers to prevent matching issues across environments
  const anyTokenPattern = new RegExp("(#?[A-Za-z0-9._/\\\\-\\u2011]+)\\u200B", "g");
  const inlineSkillTokenPattern = new RegExp("([A-Za-z0-9._/\\\\-\\u2011]+)\\u200B", "g");

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

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

  const currentMode = MODE_OPTIONS.find(m => m.value === mode) || MODE_OPTIONS[0];

  // Calculate context usage - use cumulative session stats to match TokenUsageDisplay behavior
  const { pricing } = getModelInfo(currentModel);
  const contextLimit = pricing.contextWindow;
  // Use sessionStats.totalTokens (cumulative) to match TokenUsageDisplay and Claude Code behavior
  const usedTokens = sessionStats?.totalTokens || 0;
  const inputTokens = sessionStats?.inputTokens || 0;
  const outputTokens = sessionStats?.outputTokens || 0;
  const cachedTokens = sessionStats?.cachedTokens || 0;
  const contextPercent = Math.min((usedTokens / contextLimit) * 100, 100);

  // Calculate input/output percentages for visualization
  const inputPercent = usedTokens > 0 ? (inputTokens / usedTokens) * 100 : 0;
  const outputPercent = usedTokens > 0 ? (outputTokens / usedTokens) * 100 : 0;

  // Ring calculations
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (contextPercent / 100) * circumference;

  const handleCompress = async () => {
    setIsCompressing(true);
    try {
      // Use the native /compress command from gemini-cli
      onSend("/compress", { approvalMode: currentApprovalMode });
      setShowContextTooltip(false);
    } catch (error) {
      console.error('Compression failed:', error);
    } finally {
      setIsCompressing(false);
    }
  };

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
    // Fetch installed skills
    const fetchSkills = async () => {
      try {
        const res = await fetch('/api/skills');
        if (res.ok) {
          const skills: SkillRecord[] = await res.json();
          setSkillRecords(skills);
          const skillCommands = skills.map((skill) => ({
            command: `${INLINE_SKILL_COMMAND} ${skill.id}`,
            description: skill.description || `Use ${skill.name} skill`,
            icon: Sparkles,
            group: 'Skills'
          }));
          setInstalledSkills(skillCommands);
        }
      } catch (error) {
        console.error('Failed to fetch skills for autocomplete', error);
      }
    };
    fetchSkills();

    // Fetch agents
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgentRecords(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents for autocomplete', error);
      }
    };
    fetchAgents();
  }, []);

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

      const matches = allCommands.filter(c =>
        c.command.toLowerCase().startsWith(search) ||
        (search.length > 1 && c.description.toLowerCase().includes(search.replace(/^\//, '')))
      );

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
      const reqId = ++mentionRequestCounter.current;
      const query = mentionBounds.query;
      const params = new URLSearchParams({
        index: '1',
        mentions: '1',
        limit: '120',
        q: query,
      });
      if (workspacePath) {
        params.set('path', workspacePath);
      }

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
    if (!bounds) return;

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

    const skillPrefix = mergedSkillIds.map((id) => `${INLINE_SKILL_COMMAND} ${id}`).join('\n');
    const finalMessage = skillPrefix
      ? `${skillPrefix}${cleanedInput ? `\n${cleanedInput}` : ''}`
      : cleanedInput;

    onSend(finalMessage.replace(/\u2011/g, '-'), { approvalMode: currentApprovalMode, images: uploadedImages, agentName: inlineAgentName });
    setInput('');
    setUploadedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };


  const getSkillDisplayName = (skillId: string) => {
    const found = skillRecords.find((s) => s.id === skillId);
    return found?.name || skillId;
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
            "pointer-events-auto relative inline-flex align-baseline translate-y-[1px]",
            isAgent ? "group/agent" : "group/skill"
          )}
        >
          {/* Layout Anchor - MUST MATCH TEXTAREA EXACTLY FOR CURSOR ALIGNMENT */}
          <span className="invisible select-none">{fullToken}</span>

          {/* Visual Badge - Option B: Modern Minimalist (Standardized Layout) */}
          <span className={cn(
            "absolute left-[0.5px] right-[0.5px] top-1/2 -translate-y-[55%] h-[20px] rounded-full border flex items-center transition-colors duration-200 select-none z-0 hover:z-10 shadow-sm",
            isAgent
              ? "bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-200 dark:border-slate-400 dark:text-slate-950"
              : "bg-white border-slate-200 text-slate-800 dark:bg-slate-100 dark:border-slate-300 dark:text-slate-900"
          )}>
            <span className="max-w-full text-[12px] leading-none font-medium font-sans tracking-tight pl-2 pr-6 whitespace-nowrap">
              {id}
            </span>

            {/* Close Button - Refined for Minimalist style */}
            <button
              type="button"
              className={cn(
                "absolute right-0 -top-1 h-3.5 w-3.5 rounded-full bg-slate-800 text-white border-none shadow-sm opacity-0 flex items-center justify-center hover:bg-slate-950 transition-colors duration-200 z-20",
                isAgent ? "group-hover/agent:opacity-100" : "group-hover/skill:opacity-100"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeSkillTokenRange(tokenStart, tokenEnd);
              }}
              aria-label={`Remove ${isAgent ? 'agent' : 'skill'} ${id}`}
            >
              <X className="w-2.5 h-2.5 stroke-[3px]" />
            </button>
          </span>
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
        {uploadedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {uploadedImages.map((img) => (
              <div key={img.id} className="relative group">
                <Image
                  src={img.preview}
                  alt="Uploaded"
                  width={64}
                  height={64}
                  className="w-16 h-16 object-cover rounded-lg border"
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-background border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Command Suggestions */}
        {showCommands && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50">
            <div className="max-h-64 overflow-y-auto p-1" ref={commandListRef}>
              {activeTrigger === '/' && filteredCommands.map((cmd, index) => {
                const showHeader = index === 0 || cmd.group !== filteredCommands[index - 1].group;
                return (
                  <React.Fragment key={cmd.command}>
                    {showHeader && (
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-y first:border-t-0 border-border sticky top-0 z-10 backdrop-blur-sm">
                        {cmd.group || 'Commands'}
                      </div>
                    )}
                    <button
                      data-index={index}
                      onClick={() => handleCommandSelect(cmd.command)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                        index === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                        <cmd.icon className="w-3 h-3" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">{cmd.command}</span>
                        <span className="text-[10px] opacity-70 truncate">{cmd.description}</span>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
              {activeTrigger === '@' && filteredMentions.map((mention, index) => (
                <button
                  key={mention.path}
                  data-index={index}
                  onClick={() => handleMentionSelect(mention.path)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                    {mention.type === 'directory' ? (
                      <Folder className="w-3 h-3" />
                    ) : (
                      <AtSign className="w-3 h-3" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{mention.displayPath}</span>
                    <span className="text-[10px] opacity-70">{mention.type}</span>
                  </div>
                </button>
              ))}
              {activeTrigger === 'skill' && filteredSkills.map((skill, index) => (
                <button
                  key={skill.id}
                  data-index={index}
                  onClick={() => handleSkillSelect(skill.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{INLINE_SKILL_COMMAND} {skill.id}</span>
                    <span className="text-[10px] opacity-70 truncate">{skill.name}</span>
                  </div>
                </button>
              ))}
              {activeTrigger === '#' && filteredAgents.map((agent, index) => (
                <button
                  key={agent.name}
                  data-index={index}
                  onClick={() => handleAgentSelect(agent.name)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors",
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-background border shadow-sm">
                    <User className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">#{agent.name}</span>
                    <span className="text-[10px] opacity-70 truncate">{agent.displayName || agent.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cn(
          "group/chipwrap relative flex flex-col gap-2 p-2 rounded-xl border bg-secondary transition-colors duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <div className="relative min-h-[40px] max-h-[200px]">
            {input.length === 0 && (
              <div className="pointer-events-none absolute inset-0 px-2 py-1 text-sm text-muted-foreground z-20">
                Ask anything... (Type / for commands, @ for files, # for agents, /skills id for inline skill)
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
              {/* Model Selector */}
              <ModelSelector
                value={currentModel}
                onChange={onModelChange}
                variant="inline"
              />

              <div className="w-px h-4 bg-border mx-1" />

              {/* Mode Selector - Enhanced with color coding */}
              <div className="relative" ref={modeMenuRef}>
                <button
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer z-20 relative border",
                    mode === 'code'
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20"
                      : mode === 'plan'
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                  )}
                  title={`Mode: ${currentMode.label}`}
                >
                  <currentMode.icon className="w-3.5 h-3.5" />
                  <span>{currentMode.label}</span>
                  <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", showModeMenu && "rotate-180")} />
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
                      <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Select Mode
                      </div>
                      {MODE_OPTIONS.map(opt => {
                        const isActive = opt.value === mode;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              onModeChange?.(opt.value);
                              setShowModeMenu(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 text-xs flex items-center gap-3 transition-all relative",
                              isActive
                                ? `${opt.bgColor} ${opt.color}`
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                          >
                            {!isActive && <div className={cn("absolute left-0 top-0 bottom-0 w-0.5 bg-transparent", isActive ? opt.color.replace('text-', 'bg-') : "")} />}
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              isActive ? opt.bgColor : "bg-muted"
                            )}>
                              <opt.icon className={cn("w-4 h-4", isActive ? opt.color : "text-muted-foreground")} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-semibold">{opt.label}</span>
                              <span className="text-[10px] opacity-70">{opt.description}</span>
                            </div>
                            {opt.shortcut && (
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-mono",
                                isActive ? "bg-background/30" : "bg-muted"
                              )}>
                                {opt.shortcut}
                              </span>
                            )}
                            {isActive && (
                              <div className={cn("ml-auto w-2 h-2 rounded-full", opt.color.replace('text-', 'bg-'))} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />




              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
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
              {isLoading ? (
                <button
                  onClick={onStop}
                  disabled={!onStop}
                  aria-label="Stop"
                  className={cn(
                    "group/stopbtn h-8 w-8 rounded-full transition-colors duration-200 inline-flex items-center justify-center relative",
                    onStop
                      ? "bg-foreground text-background hover:opacity-90 shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="absolute bottom-full mb-2 px-2 py-1 bg-card text-foreground text-xs rounded-md shadow-md opacity-0 invisible group-hover/stopbtn:opacity-100 group-hover/stopbtn:visible transition-colors whitespace-nowrap z-50 border border-border">
                    Stop response
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label="Send"
                  className={cn(
                    "group/sendbtn h-8 w-8 rounded-full transition-colors duration-200 inline-flex items-center justify-center relative",
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

        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div
              className="relative flex items-center gap-1.5"
              onMouseEnter={() => setShowContextTooltip(true)}
              onMouseLeave={() => setShowContextTooltip(false)}
            >
              <button
                className="flex items-center justify-center gap-1 px-1.5 h-[28px] w-[64px] text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-transparent transition-colors hidden sm:flex group"
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="8"
                      cy="8"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="transparent"
                      className="text-muted/20"
                    />
                    <circle
                      cx="8"
                      cy="8"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className={cn(
                        "transition-colors duration-300",
                        contextPercent > 90 ? "text-red-500" :
                          contextPercent > 75 ? "text-yellow-500" :
                            "text-primary"
                      )}
                    />
                  </svg>
                </div>
                <span>{contextPercent.toFixed(0)}%</span>
              </button>

              <AnimatePresence>
                {showContextTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute bottom-full mb-3 left-0 w-[280px] p-4 rounded-xl bg-background/80 dark:bg-zinc-900/80 border border-border/50 shadow-2xl backdrop-blur-xl z-50 ring-1 ring-black/5 dark:ring-white/10"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-md",
                            contextPercent > 90 ? "bg-red-500/10 text-red-500" :
                              contextPercent > 75 ? "bg-amber-500/10 text-amber-500" :
                                "bg-primary/10 text-primary"
                          )}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold tracking-wide">CONTEXT WINDOW</span>
                            <span className="text-[10px] text-muted-foreground">{currentModel}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full border",
                          contextPercent > 90 ? "bg-red-500/10 text-red-500 border-red-500/20" :
                            contextPercent > 75 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                              "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        )}>
                          {contextPercent.toFixed(1)}%
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/20">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Cached</span>
                          <span className="text-sm font-bold font-mono text-foreground flex items-center gap-1">
                            {cachedTokens.toLocaleString()}
                            <span className="text-[10px] font-normal text-muted-foreground">tok</span>
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/20">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Remaining</span>
                          <span className="text-sm font-bold font-mono text-foreground flex items-center gap-1">
                            {(contextLimit - usedTokens).toLocaleString()}
                            <span className="text-[10px] font-normal text-muted-foreground">tok</span>
                          </span>
                        </div>
                      </div>

                      {/* Input/Output Visual Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-muted-foreground/80">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                            Input
                          </span>
                          <span className="flex items-center gap-1.5">
                            Output
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden flex ring-1 ring-black/5 dark:ring-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${inputPercent}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${outputPercent}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          />
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-foreground">
                          <span className="flex items-center gap-1">
                            {inputTokens >= 1000 ? `${(inputTokens / 1000).toFixed(1)}k` : inputTokens}
                            <span className="text-[10px] text-muted-foreground font-normal">tokens</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {outputTokens >= 1000 ? `${(outputTokens / 1000).toFixed(1)}k` : outputTokens}
                            <span className="text-[10px] text-muted-foreground font-normal">tokens</span>
                          </span>
                        </div>
                      </div>

                      {/* Visual Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-medium text-muted-foreground px-0.5">
                          <span>Capacity Usage</span>
                          <span>{(contextLimit / 1000).toFixed(0)}k Limit</span>
                        </div>
                        <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/5 relative">
                          {/* Background ticks */}
                          <div className="absolute inset-0 flex justify-between px-[25%] opacity-20 z-0">
                            <div className="w-px h-full bg-foreground/50" />
                            <div className="w-px h-full bg-foreground/50" />
                            <div className="w-px h-full bg-foreground/50" />
                          </div>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(contextPercent, 2)}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={cn(
                              "h-full rounded-full relative z-10 shadow-sm",
                              contextPercent > 90
                                ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                                : contextPercent > 75
                                  ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                  : "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                            )}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompress();
                        }}
                        disabled={isCompressing}
                        className="w-full group relative overflow-hidden rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/10 text-primary transition-colors duration-200 py-2 flex items-center justify-center gap-2 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                        <RefreshCw className={cn("w-3.5 h-3.5", isCompressing && "animate-spin")} />
                        <span>{isCompressing ? "Compressing..." : "Compact"}</span>
                      </button>

                      {/* Tiny info */}
                      <div className="text-[9px] text-center text-muted-foreground/50">
                        Auto-compression at {Math.round(compressionThreshold * 100)}%
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Approval Mode Toggle */}
            <button
              onClick={() => {
                const nextMode = currentApprovalMode === 'safe' ? 'auto' : 'safe';
                setCurrentApprovalMode(nextMode);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 h-[28px] w-[64px] text-[11px] font-bold rounded-lg transition-colors duration-300 relative z-20",
                currentApprovalMode === 'auto'
                  ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 ring-1 ring-orange-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={currentApprovalMode === 'auto' ? "Auto Mode: All tool calls are allowed" : "Safe Mode: Ask for approval"}
            >
              {currentApprovalMode === 'auto' ? (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current animate-pulse shrink-0" />
                  <span>YOLO</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 opacity-70 shrink-0" />
                  <span>Safe</span>
                </>
              )}
            </button>
          </div>

          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 px-3 h-[28px] rounded-lg text-[11px] font-bold transition-colors",
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
