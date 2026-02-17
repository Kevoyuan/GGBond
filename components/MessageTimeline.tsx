'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    Bot,
    User,
    Clock,
    Hammer,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowRight,
    ChevronRight,
    FileText,
    Sparkles,
    Zap,
    Terminal
} from 'lucide-react';
import type { Message } from './MessageBubble';

interface MessageTimelineProps {
    messages: Message[];
    currentIndex?: number;
    onMessageClick?: (index: number) => void;
    className?: string;
}

// Extract tool calls from content
const extractToolCalls = (content: string): { count: number; tools: string[] } => {
    const toolCallMatches = content.match(/<tool-call[^>]*name="([^"]+)"[^>]*>/g) || [];
    const tools = toolCallMatches.map(match => {
        const nameMatch = match.match(/name="([^"]+)"/);
        return nameMatch?.[1] || 'unknown';
    });
    return { count: toolCallMatches.length, tools: [...new Set(tools)] };
};

// Get content preview
const getContentPreview = (content: string, maxLength: number = 80): string => {
    // Remove XML tags to get plain text
    const textOnly = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (textOnly.length <= maxLength) return textOnly;
    return textOnly.slice(0, maxLength) + '...';
};

function GeminiIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className}>
            <defs>
                <linearGradient id="gemini-gradient-timeline" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#4E79F5', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#D36767', stopOpacity: 1 }} />
                </linearGradient>
            </defs>
            <path
                d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z"
                fill="url(#gemini-gradient-timeline)"
            />
        </svg>
    );
}

// Get role styles
const getRoleStyle = (role: 'user' | 'model', isThinking: boolean) => {
    if (role === 'user') {
        return {
            icon: User,
            iconColor: 'text-blue-500 dark:text-blue-400',
            dotColor: 'bg-blue-500',
            ringColor: 'ring-blue-500/20',
            activeRing: 'ring-blue-500/40',
            label: 'You'
        };
    }
    if (isThinking) {
        return {
            icon: Loader2,
            iconColor: 'text-amber-500 dark:text-amber-400',
            dotColor: 'bg-amber-500',
            ringColor: 'ring-amber-500/20',
            activeRing: 'ring-amber-500/40',
            label: 'Thinking...'
        };
    }
    return {
        icon: GeminiIcon, // Use Gemini Icon
        iconColor: '', // Gradient handled by SVG
        dotColor: 'bg-purple-500',
        ringColor: 'ring-purple-500/20',
        activeRing: 'ring-purple-500/40',
        label: 'Gemini'
    };
};

export function MessageTimeline({
    messages,
    currentIndex = -1,
    onMessageClick,
    className
}: MessageTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const timelineData = useMemo(() => {
        return messages.map((msg, index) => {
            const { count: toolCount, tools } = extractToolCalls(msg.content);
            const preview = getContentPreview(msg.content);

            // Determine if thinking
            const isThinking = msg.role === 'model' && msg.thought && !msg.content;

            const roleStyle = getRoleStyle(msg.role, !!isThinking);

            return {
                index,
                ...msg,
                preview,
                toolCount,
                tools,
                isThinking,
                ...roleStyle
            };
        });
    }, [messages]);

    // Auto-scroll to active item if needed
    useEffect(() => {
        if (currentIndex >= 0 && scrollRef.current) {
            // Logic to keep active item in view could go here
        }
    }, [currentIndex]);

    if (messages.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground/60', className)}>
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 opacity-50" />
                </div>
                <p className="text-base font-medium text-foreground/80">Timeline Empty</p>
                <p className="text-sm mt-1 max-w-[180px]">Start a conversation to track message history and tool usage</p>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col h-full bg-muted/5', className)}>
            <div className="px-4 py-3 border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <NetworkIcon className="w-3.5 h-3.5" />
                    Timeline
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary/5 text-primary text-xs font-mono font-medium">
                        {messages.length}
                    </span>
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" ref={scrollRef}>
                <div className="relative pl-2">
                    {/* Gradient Timeline Line */}
                    <div className="absolute left-[11px] top-2 bottom-4 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

                    {timelineData.map((item, idx) => {
                        const isActive = currentIndex === item.index;
                        const isLast = idx === timelineData.length - 1;

                        return (
                            <div
                                key={item.id || item.index}
                                className={cn(
                                    'group relative pl-8 transition-all duration-300 ease-out',
                                    isActive ? 'opacity-100 z-10' : 'opacity-80 hover:opacity-100',
                                    item.role === 'user' ? 'py-1' : 'py-2'
                                )}
                                onClick={() => onMessageClick?.(item.index)}
                            >
                                {/* Connector Dot */}
                                <div className={cn(
                                    'absolute left-[7px] w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 z-20',
                                    'bg-background shadow-sm',
                                    item.role === 'user' ? 'top-[0.7rem]' : 'top-[1.5rem]',
                                    isActive
                                        ? cn('border-transparent scale-110', item.dotColor)
                                        : 'border-muted-foreground/30 group-hover:border-primary/50 group-hover:scale-110'
                                )}>
                                    {isActive && (
                                        <div className={cn(
                                            'absolute inset-0 rounded-full animate-ping opacity-75',
                                            item.dotColor
                                        )} />
                                    )}
                                </div>

                                {/* Card / Item */}
                                {item.role === 'user' ? (
                                    // Compact User Row
                                    <div className={cn(
                                        'relative rounded-lg px-0 py-1 cursor-pointer transition-all duration-200 border border-transparent', // Reduced padding
                                        isActive
                                            ? 'text-primary font-medium'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}>
                                        <div className="flex items-center gap-2 max-w-full">
                                            {/* Render User Icon */}
                                            <item.icon className={cn('w-4 h-4 shrink-0', item.iconColor)} />
                                            <span className="truncate text-sm opacity-90">{item.preview}</span>
                                        </div>
                                    </div>
                                ) : (
                                    // Full Card for AI / System
                                    <div className={cn(
                                        'relative rounded-xl border p-3 cursor-pointer transition-all duration-200',
                                        isActive
                                            ? 'bg-background border-primary/40 shadow-sm'
                                            : 'bg-card/40 border-transparent hover:bg-card hover:border-border/50 hover:shadow-md hover:-translate-y-0.5'
                                    )}>
                                        {/* Header */}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <item.icon className={cn('w-4 h-4', item.iconColor, item.isThinking && 'animate-spin')} />
                                            <span className={cn('text-sm font-medium', isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                                                {item.label}
                                            </span>
                                        </div>

                                        {/* Content Preview */}
                                        <p className={cn(
                                            'text-sm leading-relaxed line-clamp-2 font-normal',
                                            isActive ? 'text-foreground/90' : 'text-muted-foreground group-hover:text-foreground/80'
                                        )}>
                                            {item.preview || (item.isThinking ? 'Processing...' : '')}
                                        </p>

                                        {/* Footer: Tool Badges & Stats */}
                                        {(item.toolCount > 0 || item.stats) && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                                                {item.toolCount > 0 && (
                                                    <div className="flex gap-1 flex-wrap">
                                                        {item.tools.slice(0, 2).map((tool, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/50 text-xs font-medium text-accent-foreground border border-border/30"
                                                            >
                                                                <Terminal className="w-3 h-3 opacity-60" />
                                                                {tool}
                                                            </span>
                                                        ))}
                                                        {item.tools.length > 2 && (
                                                            <span className="text-xs text-muted-foreground px-1 py-0.5">
                                                                +{item.tools.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {item.stats && (
                                                    <div className={cn(
                                                        "flex items-center gap-1 text-xs text-muted-foreground/60 ml-auto font-mono",
                                                        item.toolCount === 0 && "ml-0"
                                                    )}>
                                                        <Zap className="w-3 h-3" />
                                                        <span>
                                                            {((item.stats.totalTokenCount || 0) / 1000).toFixed(1)}k
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function NetworkIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />
        </svg>
    )
}

