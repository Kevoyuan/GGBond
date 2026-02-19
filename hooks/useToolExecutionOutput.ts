'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ToolOutputEvent {
    toolCallId: string;
    toolName: string;
    output: string;
    isStderr: boolean;
    timestamp: number;
}

interface UseToolExecutionOutputOptions {
    sessionId: string | null;
    enabled?: boolean;
}

export function useToolExecutionOutput({ sessionId, enabled = true }: UseToolExecutionOutputOptions) {
    const [outputs, setOutputs] = useState<Map<string, string>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);

    const connect = useCallback(() => {
        if (!sessionId || !enabled || typeof window === 'undefined') {
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
            console.log('[useToolExecutionOutput] Connected to tool output stream');
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    console.log('[useToolExecutionOutput] Received connection confirmation');
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
                console.error('[useToolExecutionOutput] Error parsing event data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[useToolExecutionOutput] SSE error:', error);
            setIsConnected(false);
            eventSource.close();
            eventSourceRef.current = null;
        };

        return () => {
            eventSource.close();
            eventSourceRef.current = null;
            setIsConnected(false);
        };
    }, [sessionId, enabled]);

    useEffect(() => {
        const cleanup = connect();
        return () => {
            cleanup?.();
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [connect]);

    const getOutput = useCallback((toolCallId: string): string | undefined => {
        return outputs.get(toolCallId);
    }, [outputs]);

    const clearOutput = useCallback((toolCallId?: string) => {
        if (toolCallId) {
            setOutputs((prev) => {
                const newMap = new Map(prev);
                newMap.delete(toolCallId);
                return newMap;
            });
        } else {
            setOutputs(new Map());
        }
    }, []);

    return {
        outputs,
        isConnected,
        getOutput,
        clearOutput,
    };
}
