'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface ToolOutputEvent {
    toolCallId: string;
    toolName: string;
    output: string;
    isStderr: boolean;
    timestamp: number;
}

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
    setSessionId: () => {},
    getOutput: () => undefined,
};

const ToolExecutionOutputContext = createContext<ToolExecutionOutputContextValue>(defaultContextValue);

export function useToolExecutionOutputContext() {
    return useContext(ToolExecutionOutputContext);
}

interface ToolExecutionOutputProviderProps {
    children: React.ReactNode;
    initialSessionId?: string | null;
}

export function ToolExecutionOutputProvider({ children, initialSessionId = null }: ToolExecutionOutputProviderProps) {
    const [outputs, setOutputs] = useState<Map<string, string>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
    const eventSourceRef = useRef<EventSource | null>(null);

    const connect = useCallback(() => {
        if (!sessionId || typeof window === 'undefined') {
            return;
        }

        // Close existing connection if any
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const url = `/api/tool-output/stream?sessionId=${encodeURIComponent(sessionId)}`;
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
                    console.log('[ToolExecutionOutputProvider] Received connection confirmation');
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

        eventSource.onerror = (error) => {
            console.error('[ToolExecutionOutputProvider] SSE error:', error);
            setIsConnected(false);
            eventSource.close();
            eventSourceRef.current = null;
        };
    }, [sessionId]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
                setIsConnected(false);
            }
        };
    }, [connect]);

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
