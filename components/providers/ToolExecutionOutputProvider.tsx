'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ToolExecutionOutputContextValue {
    outputs: Map<string, string>;
    isConnected: boolean;
    sessionId: string | null;
    setSessionId: (id: string | null) => void;
    getOutput: (toolCallId: string) => string | undefined;
}

const defaultContextValue: ToolExecutionOutputContextValue = {
    outputs: new Map(),
    isConnected: false,
    sessionId: null,
    setSessionId: () => { },
    getOutput: () => undefined,
};

const ToolExecutionOutputContext = createContext<ToolExecutionOutputContextValue>(defaultContextValue);

export function useToolExecutionOutputContext() {
    return useContext(ToolExecutionOutputContext);
}

interface ToolExecutionOutputProviderProps {
    children: React.ReactNode;
    initialSessionId?: string | null;
    /**
     * Only establish an SSE connection when the AI is actively running.
     * CoreService is a single-session singleton — connecting during idle/session-switch
     * will always result in 400 session mismatch errors.
     */
    isRunning?: boolean;
}

export function ToolExecutionOutputProvider({
    children,
    initialSessionId = null,
    isRunning = false,
}: ToolExecutionOutputProviderProps) {
    const [outputs, setOutputs] = useState<Map<string, string>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Sync state with prop if it changes
    useEffect(() => {
        setSessionId(initialSessionId);
    }, [initialSessionId]);

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const connect = useCallback(async () => {
        if (!sessionId || sessionId === 'none' || typeof window === 'undefined') {
            return;
        }

        // Close any existing connection first
        disconnect();

        const url = `/api/tool-output/stream?sessionId=${encodeURIComponent(sessionId)}`;

        // Pre-flight HEAD check: EventSource.onerror cannot expose HTTP status codes.
        // A 400 here means CoreService has a different active session — bail out immediately.
        // We only connect when isRunning=true (AI executing), at which point the server's
        // active session should match ours.
        try {
            const probe = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (probe.status === 400) {
                console.warn('[ToolExecutionOutputProvider] Session not active on server (400), skipping SSE.');
                return;
            }
        } catch {
            // Network down or timeout — fall through and attempt EventSource anyway
        }

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('[ToolExecutionOutputProvider] Connected to tool output stream');
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    return;
                }

                if (data.toolCallId && data.output) {
                    setOutputs((prev) => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(data.toolCallId) || '';
                        newMap.set(data.toolCallId, existing + data.output);
                        return newMap;
                    });
                }
            } catch (error) {
                console.error('[ToolExecutionOutputProvider] Error parsing event data:', error);
            }
        };

        eventSource.onerror = () => {
            console.warn('[ToolExecutionOutputProvider] SSE connection dropped.');
            setIsConnected(false);
        };
    }, [sessionId, disconnect]);

    // Only connect when the AI is actively running. Disconnect when it stops.
    // This prevents spurious HEAD/SSE requests during session switching (idle state).
    useEffect(() => {
        if (isRunning) {
            void connect();
        } else {
            disconnect();
        }
    }, [isRunning, connect, disconnect]);

    // Always disconnect on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    const getOutput = useCallback((toolCallId: string): string | undefined => {
        return outputs.get(toolCallId);
    }, [outputs]);

    const value: ToolExecutionOutputContextValue = {
        outputs,
        isConnected,
        sessionId,
        setSessionId,
        getOutput,
    };

    return (
        <ToolExecutionOutputContext.Provider value={value}>
            {children}
        </ToolExecutionOutputContext.Provider>
    );
}
