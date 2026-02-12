import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, AtSign, Slash, Sparkles, ChevronDown, Zap, Code2, RefreshCw, MessageSquare, History, RotateCcw, Copy, Hammer, Server, Puzzle, Brain, FileText, Folder, Settings, Cpu, Palette, ArchiveRestore, Shrink, ClipboardList, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModelInfo } from '@/lib/pricing';
import { AnimatePresence, motion } from 'framer-motion';

interface ChatInputProps {
  onSend: (message: string, options?: { approvalMode?: 'safe' | 'auto' }) => void;
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
  onApprovalModeChange?: (mode: 'safe' | 'auto') => void;
  workspacePath?: string;
  onHeightChange?: (height: number) => void;
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

interface SkillSuggestionItem {
  id: string;
  name: string;
  description: string;
}

const BASE_COMMANDS: CommandItem[] = [
  // Chat Management
  { command: '/chat', description: 'Manage chat sessions (save, list, resume)', icon: MessageSquare, group: 'Built-in' },
  { command: '/clear', description: 'Clear conversation history', icon: Slash, group: 'Built-in' },
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
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'code', label: 'Code', icon: Code2, description: '读写文件 & 执行命令' },
  { value: 'plan', label: 'Plan', icon: ClipboardList, description: '分析规划，不执行' },
  { value: 'ask', label: 'Ask', icon: HelpCircle, description: '仅回答问题' },
];

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', icon: Code2 },
  { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', icon: Zap },
  { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', icon: Code2 },
  { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', icon: Zap },
  { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', icon: Zap },
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

export function ChatInput({ onSend, isLoading, currentModel, onModelChange, sessionStats, currentContextUsage, mode = 'code', onModeChange, onApprovalModeChange, workspacePath, onHeightChange }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'/' | '@' | 'skill' | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>(BASE_COMMANDS);
  const [filteredMentions, setFilteredMentions] = useState<MentionItem[]>([]);
  const [skillRecords, setSkillRecords] = useState<SkillRecord[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<SkillSuggestionItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<CommandItem[]>([]);
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
  const inlineSkillTokenPattern = new RegExp(INLINE_SKILL_TOKEN_SOURCE, 'g');
  const containerRef = useRef<HTMLDivElement>(null);

  const currentMode = MODE_OPTIONS.find(m => m.value === mode) || MODE_OPTIONS[0];

  // Calculate context usage
  const { pricing } = getModelInfo(currentModel);
  const contextLimit = pricing.contextWindow;
  // Use currentContextUsage if available, otherwise fallback to sessionStats.totalTokens (legacy) or 0
  const usedTokens = currentContextUsage !== undefined ? currentContextUsage : (sessionStats?.totalTokens || 0);
  const contextPercent = Math.min((usedTokens / contextLimit) * 100, 100);

  // Ring calculations
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (contextPercent / 100) * circumference;

  const handleCompress = async () => {
    setIsCompressing(true);
    try {
      // Use the native /compress command from gemini-cli
      onSend("/compress", { approvalMode });
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

  const getCurrentCursor = () => {
    return textareaRef.current?.selectionStart ?? cursorRef.current.start;
  };

  const getSkillTokenRangeAt = (text: string, cursor: number) => {
    const regex = new RegExp(inlineSkillTokenPattern.source, 'g');
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
    const regex = new RegExp(inlineSkillTokenPattern.source, 'g');
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
    const regex = new RegExp(inlineSkillTokenPattern.source, 'g');
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

  const insertSkillCommand = (before: string, after: string, skillId: string) => {
    const token = createSkillToken(skillId);
    const normalizedBefore = before.replace(/[ \t]+$/, '');
    const normalizedAfter = after.replace(/^[ \t]+/, '');
    const needLeadingSpace = normalizedBefore.length > 0 && !/\s$/.test(normalizedBefore);
    // Keep one trailing separator so users can immediately type plain text or another /skills command.
    const needTrailingSpace = normalizedAfter.length === 0 || !/^\s/.test(normalizedAfter);

    const left = `${normalizedBefore}${needLeadingSpace ? ' ' : ''}`;
    const right = `${needTrailingSpace ? ' ' : ''}${normalizedAfter}`;
    const value = `${left}${token}${right}`;
    const cursor = (left + token + (needTrailingSpace ? ' ' : '')).length;
    return { value, cursor };
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

    window.addEventListener('insert-skill-token', handler as EventListener);
    return () => window.removeEventListener('insert-skill-token', handler as EventListener);
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
    } else {
      setActiveTrigger(null);
      setShowCommands(false);
    }
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
    if (isLoading) return;

    const typedSkillPattern = /(\/skills?)\s+([A-Za-z0-9._/-]+)(?=\s|$)/g;
    const inlineTokenRegex = new RegExp(inlineSkillTokenPattern.source, 'g');
    const typedSkillMatches = Array.from(input.matchAll(typedSkillPattern));
    const tokenSkillIds = Array.from(
      input.matchAll(inlineTokenRegex)
    ).map((m) => m[1]);
    const typedSkillIds = typedSkillMatches
      .map((m) => m[2])
      .filter((id) => !SKILLS_MANAGEMENT_SUBCOMMANDS.has(id.toLowerCase()));
    const mergedSkillIds = Array.from(new Set([...tokenSkillIds, ...typedSkillIds]));

    // Keep inline skill ids in the sentence when the user wrote surrounding text
    // (e.g. "你会不会用 <skillA> 和 <skillB>"), but keep old behavior for skill-only sends.
    const hasNonSkillText = input
      .replace(inlineTokenRegex, '')
      .replace(typedSkillPattern, (full, _command, id) => (
        SKILLS_MANAGEMENT_SUBCOMMANDS.has(String(id).toLowerCase()) ? full : ''
      ))
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim().length > 0;

    const cleanedInput = input
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

    onSend(finalMessage.replace(/\u2011/g, '-'), { approvalMode });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const getModelName = (id: string) => {
    const m = MODELS.find(m => m.id === id);
    return m ? m.name : id;
  };

  const getSkillDisplayName = (skillId: string) => {
    const found = skillRecords.find((s) => s.id === skillId);
    return found?.name || skillId;
  };

  const renderInlineSkillText = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = new RegExp(inlineSkillTokenPattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="pointer-events-none">{input.slice(lastIndex, match.index)}</span>
        );
      }
      const skillId = match[1].replace(/\u2011/g, '-');
      const tokenStart = match.index;
      const tokenEnd = match.index + match[0].length;
      parts.push(
        <span
          key={`skill-${match.index}-${skillId}`}
          className="group/skill pointer-events-auto relative inline-flex align-baseline translate-y-[1px]"
        >
          {/* Layout Anchor - Matches textarea content exactly (including hidden marker) */}
          <span className="invisible select-none">{match[0]}</span>

          {/* Visual Badge - Optimized for line-height and minimizing overlap */}
          <span className="absolute -left-[3px] -right-[3px] top-1/2 -translate-y-[55%] h-[20px] rounded-[6px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500/40 hover:shadow-sm flex items-center justify-center transition-all duration-200 select-none z-0 hover:z-10">
            <span className="truncate max-w-full px-1.5 text-[10px] leading-none font-semibold text-blue-600 dark:text-blue-400 font-mono tracking-tight">
              {getSkillDisplayName(skillId)}
            </span>

            {/* Close Button - Appearing on hover with enhanced visibility */}
            <button
              type="button"
              data-skill-remove="true"
              className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-background border shadow-sm opacity-0 group-hover/skill:opacity-100 flex items-center justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 z-20 scale-90 hover:scale-100"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeSkillTokenRange(tokenStart, tokenEnd);
              }}
              aria-label={`Remove skill ${skillId}`}
            >
              <span className="text-[10px] font-bold leading-none mb-px">×</span>
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

  const [approvalMode, setApprovalMode] = useState<'safe' | 'auto'>('safe');

  useEffect(() => {
    onApprovalModeChange?.(approvalMode);
  }, [approvalMode, onApprovalModeChange]);

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
            </div>
          </div>
        )}

        <div className={cn(
          "group/chipwrap relative flex flex-col gap-2 p-2 rounded-xl border bg-secondary transition-all duration-200",
          "focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30"
        )}>
          <div className="relative min-h-[40px] max-h-[200px]">
            {input.length === 0 && (
              <div className="pointer-events-none absolute inset-0 px-2 py-1 text-sm text-muted-foreground z-20">
                Ask anything... (Type / for commands, @ for files, /skills id for inline skill)
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
              placeholder=""
              className="absolute inset-0 w-full h-full bg-transparent border-none focus:outline-none resize-none text-transparent caret-foreground selection:bg-primary/20 text-sm leading-relaxed px-2 py-1 z-0"
              rows={1}
              style={{ minHeight: '40px' }}
            />

            {/* 2. Overlay (Visual Layer) - z-10, pointer-events-none */}
            <div
              ref={inputOverlayRef}
              aria-hidden
              className="relative z-10 pointer-events-none whitespace-pre-wrap break-words px-2 py-1 text-sm leading-relaxed min-h-[40px] max-h-[200px] overflow-y-auto"
            >
              {renderInlineSkillText()}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 relative">
              {/* Model Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors mr-1 cursor-pointer z-20 relative"
                  title="Select Model"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{getModelName(currentModel)}</span>
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>

                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
                      {MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onModelChange(model.id);
                            setShowModelMenu(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors",
                            currentModel === model.id
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <model.icon className="w-3.5 h-3.5" />
                          <span>{model.name}</span>
                          {currentModel === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Mode Selector */}
              <div className="relative" ref={modeMenuRef}>
                <button
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer z-20 relative"
                  title={`Mode: ${currentMode.label}`}
                >
                  <currentMode.icon className="w-3.5 h-3.5" />
                  <span>{currentMode.label}</span>
                  <ChevronDown className={cn("w-3 h-3 opacity-50 transition-transform duration-200", showModeMenu && "rotate-180")} />
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-background border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-50 py-1">
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
                              "w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors",
                              isActive
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                          >
                            <opt.icon className="w-4 h-4 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-[10px] opacity-70">{opt.description}</span>
                            </div>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-4 bg-border mx-1" />

              {/* Approval Mode Toggle */}
              <button
                onClick={() => {
                  const nextMode = approvalMode === 'safe' ? 'auto' : 'safe';
                  setApprovalMode(nextMode);
                  if (onApprovalModeChange) onApprovalModeChange(nextMode);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all duration-300",
                  approvalMode === 'auto'
                    ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 ring-1 ring-red-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={approvalMode === 'auto' ? "Auto Mode: All tool calls are allowed" : "Safe Mode: Ask for approval"}
              >
                {approvalMode === 'auto' ? (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
                    <span>Auto</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  </>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border border-current opacity-70" />
                    <span>Safe</span>
                  </>
                )}
              </button>

              <div className="w-px h-4 bg-border mx-1" />


              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Add Image">
                <ImageIcon className="w-4 h-4" />
              </button>

              <div
                className="relative flex items-center gap-1.5"
                onMouseEnter={() => setShowContextTooltip(true)}
                onMouseLeave={() => setShowContextTooltip(false)}
              >
                <button
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors hidden sm:flex group"
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
                          "transition-all duration-500",
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
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 text-white"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-400">Context Usage</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-semibold tracking-tight">
                              {contextPercent.toFixed(0)}%
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              of {(contextLimit / 1000).toFixed(0)}K
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            {usedTokens.toLocaleString()} tokens used
                          </div>
                        </div>

                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              contextPercent > 90 ? "bg-red-500" :
                                contextPercent > 75 ? "bg-yellow-500" :
                                  "bg-blue-500"
                            )}
                            style={{ width: `${contextPercent}%` }}
                          />
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompress();
                          }}
                          disabled={isCompressing}
                          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-xs font-medium text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isCompressing && "animate-spin")} />
                          {isCompressing ? "Compressing..." : "Compress Context"}
                        </button>
                      </div>

                      {/* Arrow */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e1e] border-b border-r border-white/10 rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                Cmd+Enter
              </span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200 flex items-center justify-center",
                  input.trim() && !isLoading
                    ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
