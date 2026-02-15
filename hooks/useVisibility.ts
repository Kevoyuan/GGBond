'use client';

import { useEffect, useRef } from 'react';

export interface UseVisibilityOptions {
  currentSessionId: string | null;
  loadSessionTree: ((sessionId: string) => Promise<unknown>) | null;
  pollIntervalMs?: number;
}

type UseVisibilityReturn = void;

/**
 * Hook to handle page visibility changes and background polling.
 * Polls for background job status when the page is hidden,
 * and immediately checks when the page becomes visible.
 */
export function useVisibility({
  currentSessionId,
  loadSessionTree,
  pollIntervalMs = 5000,
}: UseVisibilityOptions): UseVisibilityReturn {
  const loadSessionTreeRef = useRef(loadSessionTree);

  useEffect(() => {
    loadSessionTreeRef.current = loadSessionTree;
  }, [loadSessionTree]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const checkBackgroundJobs = async () => {
      if (!currentSessionId || !loadSessionTreeRef.current) return;

      try {
        const res = await fetch(`/api/chat/status?sessionId=${currentSessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hasRunningJobs) {
            console.log('[visibility] Background job detected, reloading session...');
            await loadSessionTreeRef.current(currentSessionId);
          }
        }
      } catch (e) {
        console.error('[visibility] Failed to check background status:', e);
      }
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';

      if (isVisible) {
        void checkBackgroundJobs();
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      } else {
        pollInterval = setInterval(() => {
          void checkBackgroundJobs();
        }, pollIntervalMs);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.visibilityState === 'hidden') {
      pollInterval = setInterval(() => {
        void checkBackgroundJobs();
      }, pollIntervalMs);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentSessionId, pollIntervalMs]);
}
