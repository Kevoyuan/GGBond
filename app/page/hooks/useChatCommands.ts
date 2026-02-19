import { useCallback } from 'react';
import type { Message } from '@/components/MessageBubble';
import type { Session, ChatSnapshot } from '../types';

interface UseChatCommandsParams {
  currentSessionId: string | null;
  headId: string | null;
  messages: Message[];
  sessions: Session[];
  addMessageToTree: (message: Message, parentId: string | null) => void;
}

export function useChatCommands({
  currentSessionId,
  headId,
  messages,
  sessions,
  addMessageToTree,
}: UseChatCommandsParams) {
  const handleChatList = useCallback(async () => {
    if (!currentSessionId) {
      addMessageToTree({ role: 'model', content: '⚠️ No active session. Start a conversation first.' }, headId);
      return;
    }

    try {
      const res = await fetch(`/api/chat/snapshots?session_id=${encodeURIComponent(currentSessionId)}`);
      const data = await res.json();

      if (!res.ok) {
        addMessageToTree({ role: 'model', content: `⚠️ Failed to list snapshots: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      const snapshots = data.snapshots || [];
      if (snapshots.length === 0) {
        addMessageToTree({ role: 'model', content: '📋 No saved snapshots found for this session.' }, headId);
        return;
      }

      const listContent = [
        '## Chat Snapshots',
        '',
        ...snapshots.map((s: ChatSnapshot) =>
          `- **${s.tag}**${s.title ? ` - ${s.title}` : ''} (${s.message_count} messages, ${s.created_at_formatted})`
        ),
        '',
        'Use `/chat save <tag>` to save current session state',
        'Use `/chat resume <tag>` to restore a snapshot'
      ].join('\n');

      addMessageToTree({ role: 'model', content: listContent }, headId);
    } catch (error) {
      console.error('[chat] Failed to list snapshots:', error);
      addMessageToTree({ role: 'model', content: '⚠️ Failed to list snapshots' }, headId);
    }
  }, [currentSessionId, headId, addMessageToTree]);

  const handleChatSave = useCallback(async (tag: string) => {
    if (!currentSessionId || !headId) {
      addMessageToTree({ role: 'model', content: '⚠️ No active session. Start a conversation first.' }, headId);
      return;
    }

    // Validate tag format
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      addMessageToTree({
        role: 'model',
        content: '⚠️ Tag must contain only alphanumeric characters, dashes, and underscores.'
      }, headId);
      return;
    }

    try {
      const messageCount = messages.length;
      const sessionTitle = sessions.find(s => s.id === currentSessionId)?.title || 'Untitled';

      const res = await fetch('/api/chat/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          session_id: currentSessionId,
          tag,
          title: sessionTitle,
          message_count: messageCount
        })
      });

      const data = await res.json();

      if (!res.ok) {
        addMessageToTree({ role: 'model', content: `⚠️ Failed to save snapshot: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      addMessageToTree({
        role: 'model',
        content: `✅ Snapshot saved: **${tag}**\n\n- Session: ${sessionTitle}\n- Messages: ${messageCount}\n\nUse \`/chat resume ${tag}\` to restore this snapshot later.`
      }, headId);
      console.info(`[chat] Snapshot saved: ${tag} for session ${currentSessionId}`);
    } catch (error) {
      console.error('[chat] Failed to save snapshot:', error);
      addMessageToTree({ role: 'model', content: '⚠️ Failed to save snapshot' }, headId);
    }
  }, [currentSessionId, headId, messages, sessions, addMessageToTree]);

  const handleChatResume = useCallback(async (tag: string) => {
    if (!currentSessionId || !headId) {
      addMessageToTree({ role: 'model', content: '⚠️ No active session. Start a conversation first.' }, headId);
      return;
    }

    try {
      const listRes = await fetch(`/api/chat/snapshots?session_id=${encodeURIComponent(currentSessionId)}`);
      const listData = await listRes.json();

      if (!listRes.ok) {
        addMessageToTree({ role: 'model', content: `⚠️ Failed to find snapshot: ${listData.error || 'Unknown error'}` }, headId);
        return;
      }

      const snapshot = (listData.snapshots || []).find((s: ChatSnapshot) => s.tag === tag);

      if (!snapshot) {
        addMessageToTree({
          role: 'model',
          content: `⚠️ Snapshot **${tag}** not found.\n\nUse \`/chat list\` to see available snapshots.`
        }, headId);
        return;
      }

      // Call the API to create a new session from the snapshot
      const resumeRes = await fetch('/api/chat/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          session_id: currentSessionId,
          tag
        })
      });

      const resumeData = await resumeRes.json();

      if (!resumeRes.ok) {
        addMessageToTree({
          role: 'model',
          content: `⚠️ Failed to resume snapshot: ${resumeData.error || 'Unknown error'}`
        }, headId);
        return;
      }

      addMessageToTree({
        role: 'model',
        content: `✅ Snapshot **${tag}** restored!\n\nNew session created: **${resumeData.newSessionTitle}**\n\nUse \`/chat list\` to see all snapshots.`
      }, headId);
    } catch (error) {
      console.error('[chat] Failed to resume snapshot:', error);
      addMessageToTree({ role: 'model', content: '⚠️ Failed to resume snapshot' }, headId);
    }
  }, [currentSessionId, headId, addMessageToTree]);

  const handleChatDelete = useCallback(async (tag: string) => {
    if (!currentSessionId || !headId) {
      addMessageToTree({ role: 'model', content: '⚠️ No active session. Start a conversation first.' }, headId);
      return;
    }

    try {
      const res = await fetch('/api/chat/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          session_id: currentSessionId,
          tag
        })
      });

      const data = await res.json();

      if (!res.ok) {
        addMessageToTree({ role: 'model', content: `⚠️ Failed to delete snapshot: ${data.error || 'Unknown error'}` }, headId);
        return;
      }

      addMessageToTree({
        role: 'model',
        content: `🗑️ Snapshot **${tag}** deleted.`
      }, headId);
    } catch (error) {
      console.error('[chat] Failed to delete snapshot:', error);
      addMessageToTree({ role: 'model', content: '⚠️ Failed to delete snapshot' }, headId);
    }
  }, [currentSessionId, headId, addMessageToTree]);

  return {
    handleChatList,
    handleChatSave,
    handleChatResume,
    handleChatDelete,
  };
}
