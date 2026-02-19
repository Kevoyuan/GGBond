import type { Message } from '../../components/MessageBubble';
import type { ChatSettings } from '../../components/SettingsDialog';
import type { UndoPreviewFileChange } from '../../components/UndoMessageConfirmDialog';

// ============================================================================
// Types
// ============================================================================

export interface Session {
  id: string;
  title: string;
  created_at: string | number;
  updated_at: string | number;
  workspace?: string;
  branch?: string | null;
  archived?: number | boolean;
  isCore?: boolean;
  lastUpdated?: string;
}

export interface ApiMessageRecord {
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

export interface UndoConfirmState {
  sessionId: string;
  messageId: string;
  messageContent: string;
  workspace: string | null;
  model: string;
  hasCheckpoint: boolean;
  fileChanges: UndoPreviewFileChange[];
}

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  dataUrl: string;
}

export interface ChatSnapshot {
  id: number;
  session_id: string;
  tag: string;
  title?: string;
  message_count: number;
  session_title?: string;
  created_at: number;
  created_at_formatted: string;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_TERMINAL_PANEL_HEIGHT = 360;

export const ALLOWED_MODELS = new Set([
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  model: 'gemini-3-pro-preview',
  systemInstruction: '',
  toolPermissionStrategy: 'safe',
  ui: {
    lowLatencyMode: true,
    advancedMode: false,
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

// ============================================================================
// Utility Functions
// ============================================================================

export const toMessageId = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

export const toStatsValue = (value: unknown): Message['stats'] | undefined => {
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

export const buildTreeFromApiMessages = (rawMessages: ApiMessageRecord[]) => {
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

export const normalizeChatSettings = (input: Partial<ChatSettings> | null | undefined): ChatSettings => {
  const safeInput = input || {};
  const nextModel = ALLOWED_MODELS.has(safeInput.model || '')
    ? (safeInput.model as string)
    : DEFAULT_CHAT_SETTINGS.model;

  return {
    model: nextModel,
    systemInstruction: safeInput.systemInstruction ?? DEFAULT_CHAT_SETTINGS.systemInstruction,
    toolPermissionStrategy: safeInput.toolPermissionStrategy === 'auto' ? 'auto' : 'safe',
    ui: {
      lowLatencyMode: safeInput.ui?.lowLatencyMode ?? DEFAULT_CHAT_SETTINGS.ui.lowLatencyMode,
      advancedMode: safeInput.ui?.advancedMode ?? DEFAULT_CHAT_SETTINGS.ui.advancedMode,
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
