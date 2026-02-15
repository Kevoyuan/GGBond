import { useState, useCallback, useEffect, useRef } from 'react';
import type { HookEvent, HookEventType } from '@/components/HooksPanel';

type EventListener = (event: HookEvent) => void;

class HookEventBus {
    private static instance: HookEventBus;
    private listeners: Set<EventListener> = new Set();
    private events: HookEvent[] = [];
    private maxEvents = 500;

    static getInstance(): HookEventBus {
        if (!HookEventBus.instance) {
            HookEventBus.instance = new HookEventBus();
        }
        return HookEventBus.instance;
    }

    subscribe(listener: EventListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    emit(event: HookEvent) {
        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
        this.listeners.forEach(listener => listener(event));
    }

    getEvents(): HookEvent[] {
        return [...this.events];
    }

    clear() {
        this.events = [];
    }

    filterByType(type: HookEventType | HookEventType[]): HookEvent[] {
        const types = Array.isArray(type) ? type : [type];
        return this.events.filter(e => types.includes(e.type));
    }

    search(query: string): HookEvent[] {
        const lowerQuery = query.toLowerCase();
        return this.events.filter(e =>
            e.name.toLowerCase().includes(lowerQuery) ||
            e.toolName?.toLowerCase().includes(lowerQuery) ||
            e.serverName?.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(e.data).toLowerCase().includes(lowerQuery)
        );
    }
}

export function useHooks() {
    const [events, setEvents] = useState<HookEvent[]>([]);
    const busRef = useRef(HookEventBus.getInstance());

    useEffect(() => {
        // Load initial events
        setEvents(busRef.current.getEvents());

        // Subscribe to new events
        const unsubscribe = busRef.current.subscribe((event) => {
            setEvents(prev => {
                const newEvents = [...prev, event];
                if (newEvents.length > 500) {
                    return newEvents.slice(-500);
                }
                return newEvents;
            });
        });

        return unsubscribe;
    }, []);

    const emit = useCallback((event: Omit<HookEvent, 'id' | 'timestamp'>) => {
        const fullEvent: HookEvent = {
            ...event,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };
        busRef.current.emit(fullEvent);
        return fullEvent;
    }, []);

    const emitToolCall = useCallback((
        name: string,
        toolName?: string,
        serverName?: string,
        data?: Record<string, unknown>,
        correlationId?: string
    ) => {
        return emit({
            type: 'tool_call',
            name,
            toolName: toolName || name,
            serverName,
            data,
            correlationId
        });
    }, [emit]);

    const emitToolResult = useCallback((
        name: string,
        toolName?: string,
        duration?: number,
        outcome?: { decision?: 'approve' | 'deny' | 'allow' | 'cancel' | 'proceed'; error?: string }
    ) => {
        return emit({
            type: 'tool_result',
            name,
            toolName: toolName || name,
            duration,
            outcome
        });
    }, [emit]);

    const emitConfirmation = useCallback((
        name: string,
        toolName: string,
        correlationId: string,
        data?: Record<string, unknown>
    ) => {
        return emit({
            type: 'confirmation_request',
            name,
            toolName,
            correlationId,
            data,
            outcome: { decision: 'pending' }
        });
    }, [emit]);

    const emitConfirmationResponse = useCallback((
        correlationId: string,
        decision: 'approve' | 'deny' | 'allow' | 'cancel' | 'proceed'
    ) => {
        return emit({
            type: 'confirmation_response',
            name: 'Confirmation Response',
            correlationId,
            outcome: { decision }
        });
    }, [emit]);

    const emitAskUser = useCallback((
        correlationId: string,
        title: string,
        data?: Record<string, unknown>
    ) => {
        return emit({
            type: 'ask_user',
            name: title,
            correlationId,
            data
        });
    }, [emit]);

    const emitError = useCallback((
        name: string,
        error: string,
        data?: Record<string, unknown>
    ) => {
        return emit({
            type: 'error',
            name,
            outcome: { error }
        });
    }, [emit]);

    const emitThought = useCallback((
        content: string,
        data?: Record<string, unknown>
    ) => {
        return emit({
            type: 'thought',
            name: 'Thinking',
            data: { content, ...data }
        });
    }, [emit]);

    const clear = useCallback(() => {
        busRef.current.clear();
        setEvents([]);
    }, []);

    return {
        events,
        emit,
        emitToolCall,
        emitToolResult,
        emitConfirmation,
        emitConfirmationResponse,
        emitAskUser,
        emitError,
        emitThought,
        clear
    };
}

// Helper to create events from Gemini CLI events
export function createHookEventFromGemini(
    type: HookEventType,
    name: string,
    data?: Record<string, unknown>
): Omit<HookEvent, 'id' | 'timestamp'> {
    return {
        type,
        name,
        data
    };
}

// Map GeminiEventType to HookEventType
export function mapGeminiEventToHook(
    geminiEventType: string
): HookEventType {
    const mapping: Record<string, HookEventType> = {
        'content': 'content',
        'thought': 'thought',
        'tool_call_request': 'tool_call',
        'tool_call_response': 'tool_result',
        'error': 'error',
        'finished': 'finished',
        'max_session_turns': 'max_turns'
    };
    return mapping[geminiEventType] || 'content';
}
