'use client';

import { useState, useCallback, useEffect } from 'react';
import { fetchJsonWithRetry } from '@/lib/client-fetch';
import { bootMark } from '@/lib/boot-telemetry';
import type { Session } from '../types';

interface UseSessionsProps {
  showWarningToast: (msg: string) => void;
}

export function useSessions({ showWarningToast }: UseSessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    bootMark('app:sessions-fetch-start');
    try {
      const { response, data } = await fetchJsonWithRetry<Session[] | { error?: string; _fallback?: boolean }>(
        '/api/sessions',
        undefined,
        { retries: 3, retryDelayMs: 200 }
      );

      if (!response.ok || !Array.isArray(data)) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Session service returned ${response.status}`;
        throw new Error(message);
      }

      const allSessions = [...data];

      // Sort by updated_at desc (most recent first)
      allSessions.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.lastUpdated || 0).getTime();
        const timeB = new Date(b.updated_at || b.lastUpdated || 0).getTime();
        return timeB - timeA;
      });

      setSessions(allSessions);
      bootMark('app:sessions-fetch-done', { count: allSessions.length });
    } catch (error) {
      console.error('Failed to fetch sessions', error);
      const message = error instanceof Error ? error.message : String(error);
      bootMark('app:sessions-fetch-fail', { error: message });
      showWarningToast(`Sessions are temporarily unavailable: ${message}`);
    }
  }, [showWarningToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    setSessions,
    fetchSessions,
  };
}
