'use client';

import { useState, useRef, useCallback } from 'react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  dataUrl: string;
}

interface QueuedMessage {
  content: string;
  images?: UploadedImage[];
  tempId?: string;
  parentId?: string;
  sessionId: string;
}

export interface UseChatQueueReturn {
  pendingMessages: QueuedMessage[];
  pendingMessagesRef: React.MutableRefObject<QueuedMessage[]>;
  handleAddToQueue: (text: string, images?: UploadedImage[], currentSessionId?: string, headIdRef?: React.MutableRefObject<string | null>) => void;
  processQueue: () => Promise<void>;
}

export interface UseChatQueueOptions {
  currentSessionId: string | null;
  headIdRef: React.MutableRefObject<string | null>;
  loadSessionTree: (sessionId: string) => Promise<{ nextHeadId: string | null; session?: unknown }>;
  setCurrentSessionId: (id: string) => void;
  setCurrentWorkspace: (workspace: string | null) => void;
  addMessageToTree: (msg: unknown, parentId: string | null) => string;
  handleSendMessage: (
    text: string,
    options?: {
      parentId?: string;
      approvalMode?: 'safe' | 'auto';
      images?: UploadedImage[];
      reuseMessageId?: string;
      sessionId?: string;
      agentName?: string;
    }
  ) => Promise<void>;
}

export function useChatQueue({
  currentSessionId,
  headIdRef,
  loadSessionTree,
  setCurrentSessionId,
  setCurrentWorkspace,
  addMessageToTree,
  handleSendMessage,
}: UseChatQueueOptions): UseChatQueueReturn {
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);
  const pendingMessagesRef = useRef<QueuedMessage[]>([]);

  const processQueue = useCallback(async () => {
    const currentMessages = pendingMessagesRef.current;
    if (currentMessages.length === 0) return;

    const [nextMsg, ...remaining] = currentMessages;
    pendingMessagesRef.current = remaining;
    setPendingMessages(remaining);

    let effectiveHeadId = headIdRef.current;

    if (nextMsg.sessionId && nextMsg.sessionId !== currentSessionId) {
      console.log(`[queue] Switching session from ${currentSessionId} to ${nextMsg.sessionId}`);
      if (loadSessionTree) {
        const data = await loadSessionTree(nextMsg.sessionId);
        setCurrentSessionId(nextMsg.sessionId);
        effectiveHeadId = data.nextHeadId;

        if (data.session && typeof data.session === 'object' && 'workspace' in data.session) {
          setCurrentWorkspace((data.session as { workspace?: string }).workspace || null);
        }
      }
    }

    await handleSendMessage(nextMsg.content, {
      images: nextMsg.images,
      reuseMessageId: nextMsg.tempId,
      parentId: effectiveHeadId || undefined,
      sessionId: nextMsg.sessionId
    });
  }, [
    currentSessionId,
    headIdRef,
    loadSessionTree,
    setCurrentSessionId,
    setCurrentWorkspace,
    handleSendMessage
  ]);

  const handleAddToQueue = useCallback((
    text: string,
    images?: UploadedImage[],
    currentSessionId?: string,
    headIdRefArg?: React.MutableRefObject<string | null>
  ) => {
    const sessionId = currentSessionId;
    if (!sessionId) return;

    const refToUse = headIdRefArg || headIdRef;
    const lastQueuedMsg = pendingMessagesRef.current[pendingMessagesRef.current.length - 1];
    const parentId = (lastQueuedMsg?.tempId || refToUse.current) ?? undefined;

    const tempId = `queued-${Date.now()}`;
    const newMsg: QueuedMessage = { content: text, images, tempId, sessionId };
    if (parentId) newMsg.parentId = parentId;

    pendingMessagesRef.current = [...pendingMessagesRef.current, newMsg];
    setPendingMessages(prev => [...prev, newMsg]);

    // Add queued message bubble to chat
    addMessageToTree({
      id: tempId,
      role: 'user',
      content: text,
      queued: true,
      tempId,
      sessionId
    }, parentId || null);
  }, [headIdRef, addMessageToTree]);

  return {
    pendingMessages,
    pendingMessagesRef,
    handleAddToQueue,
    processQueue,
  };
}
