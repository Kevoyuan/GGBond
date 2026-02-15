'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Session {
  id: string;
  title: string;
  created_at: string | number;
  updated_at: string | number;
  workspace?: string;
  isCore?: boolean;
  lastUpdated?: string;
}

export interface UseSessionManagementReturn {
  sessions: Session[];
  currentSessionId: string | null;
  currentWorkspace: string | null;
  isSessionLoading: boolean;
  fetchSessions: () => Promise<void>;
  handleSelectSession: (id: string) => Promise<void>;
  handleNewChat: () => void;
  handleNewChatInWorkspace: (workspace: string) => void;
  handleAddWorkspace: (workspacePath: string) => void;
  handleDeleteSession: (id: string) => Promise<void>;
  setCurrentSessionId: (id: string | null) => void;
  setCurrentWorkspace: (workspace: string | null) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
}

export function useSessionManagement(
  loadSessionTree: (sessionId: string) => Promise<{ session?: Session; nextHeadId: string | null }>,
  setMessagesMap: (map: Map<string, unknown>) => void,
  setHeadId: (id: string | null) => void,
  headIdRef: React.MutableRefObject<string | null>,
  onSelectSession?: (id: string) => void
): UseSessionManagementReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
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
        const coreFiltered = coreSessions.filter((cs: Session) => !allSessions.some(s => s.id === cs.id));
        allSessions = [...allSessions, ...coreFiltered];
      }

      allSessions.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.lastUpdated || 0).getTime();
        const timeB = new Date(b.updated_at || b.lastUpdated || 0).getTime();
        return timeB - timeA;
      });

      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === currentSessionId) return;

    setIsSessionLoading(true);
    setCurrentSessionId(id);

    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentWorkspace(session.workspace || null);
    }

    try {
      const data = await loadSessionTree(id);
      if (!session && data.session?.workspace) {
        setCurrentWorkspace((data.session as Session).workspace || null);
      }
      onSelectSession?.(id);
    } catch (error) {
      console.error('Failed to load session', error);
    } finally {
      setIsSessionLoading(false);
    }
  }, [currentSessionId, sessions, loadSessionTree, onSelectSession]);

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setCurrentWorkspace(null);
    setMessagesMap(new Map());
    setHeadId(null);
    headIdRef.current = null;
  }, [setMessagesMap, setHeadId, headIdRef]);

  const handleNewChatInWorkspace = useCallback((workspace: string) => {
    setCurrentSessionId(null);
    setCurrentWorkspace(workspace);
    setMessagesMap(new Map());
    setHeadId(null);
    headIdRef.current = null;
  }, [setMessagesMap, setHeadId, headIdRef]);

  const handleAddWorkspace = useCallback((workspacePath: string) => {
    setCurrentSessionId(null);
    setCurrentWorkspace(workspacePath);
    setMessagesMap(new Map());
    setHeadId(null);
    headIdRef.current = null;
  }, [setMessagesMap, setHeadId, headIdRef]);

  const handleDeleteSession = useCallback(async (id: string) => {
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
  }, [currentSessionId, handleNewChat]);

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  return {
    sessions,
    currentSessionId,
    currentWorkspace,
    isSessionLoading,
    fetchSessions,
    handleSelectSession,
    handleNewChat,
    handleNewChatInWorkspace,
    handleAddWorkspace,
    handleDeleteSession,
    setCurrentSessionId,
    setCurrentWorkspace,
    updateSession,
  };
}
