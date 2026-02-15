'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Message } from '@/components/MessageBubble';

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

export interface UseMessageTreeReturn {
  messagesMap: Map<string, Message>;
  headId: string | null;
  messages: Message[];
  loadSessionTree: (sessionId: string) => Promise<{ nextMap: Map<string, Message>; nextHeadId: string | null; session?: unknown }>;
  addMessageToTree: (msg: Message, parentId: string | null) => string;
  updateMessageInTree: (id: string, updates: Partial<Message>) => void;
  pruneLocalBranchFrom: (rootMessageId: string) => void;
  setHeadId: (id: string | null) => void;
  headIdRef: React.MutableRefObject<string | null>;
}

interface PendingMessage {
  content: string;
  images?: Array<{ dataUrl: string; type: string; name: string }>;
  tempId?: string;
  parentId?: string;
  sessionId: string;
}

export function useMessageTree(
  pendingMessagesRef: React.MutableRefObject<PendingMessage[]>
): UseMessageTreeReturn {
  const [messagesMap, setMessagesMap] = useState<Map<string, Message>>(new Map());
  const [headId, setHeadId] = useState<string | null>(null);
  const headIdRef = useRef<string | null>(null);

  // Sync state to ref
  useEffect(() => {
    headIdRef.current = headId;
  }, [headId]);

  // Derived linear thread
  const messages = useMemo(() => {
    const list: Message[] = [];
    let currentId = headId;
    let depth = 0;
    while (currentId && depth < 2000) {
      const msg = messagesMap.get(currentId);
      if (!msg) break;
      list.unshift(msg);
      currentId = msg.parentId || null;
      depth++;
    }
    return list;
  }, [headId, messagesMap]);

  const loadSessionTree = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`Failed to load session: ${sessionId}`);
    }

    const data = await res.json() as { messages?: ApiMessageRecord[]; session?: unknown };
    const rawMessages = Array.isArray(data.messages) ? data.messages : [];
    const { nextMap, nextHeadId } = buildTreeFromApiMessages(rawMessages);

    // Merge pending messages into the map
    const pendingMessages = pendingMessagesRef.current;
    if (pendingMessages.length > 0) {
      pendingMessages.forEach(pm => {
        const queueId = pm.tempId || `queued-${Date.now()}-${Math.random()}`;
        if (pm.sessionId === sessionId && !nextMap.has(queueId)) {
          nextMap.set(queueId, {
            id: queueId,
            role: 'user',
            content: pm.content,
            queued: true,
            parentId: (pm.parentId || nextHeadId) ?? null,
            sessionId: pm.sessionId,
            images: pm.images?.map(img => ({
              dataUrl: img.dataUrl,
              type: img.type,
              name: img.name
            }))
          });
        }
      });
    }

    setMessagesMap(nextMap);
    setHeadId(nextHeadId);
    headIdRef.current = nextHeadId;

    return { ...data, nextMap, nextHeadId };
  }, [pendingMessagesRef]);

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

  return {
    messagesMap,
    headId,
    messages,
    loadSessionTree,
    addMessageToTree,
    updateMessageInTree,
    pruneLocalBranchFrom,
    setHeadId,
    headIdRef,
  };
}
