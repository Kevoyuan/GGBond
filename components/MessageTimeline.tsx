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
        icon: Bot,
        iconColor: 'text-purple-500 dark:text-purple-400',
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
                <p className="text-sm font-medium text-foreground/80">Timeline Empty</p>
                <p className="text-xs mt-1 max-w-[180px]">Start a conversation to track message history and tool usage</p>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col h-full bg-muted/5', className)}>
            <div className="px-4 py-3 border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <NetworkIcon className="w-3.5 h-3.5" />
                    Timeline
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-mono font-medium">
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
                                    'group relative pl-8 py-2 transition-all duration-300 ease-out',
                                    isActive ? 'opacity-100 scale-[1.02] z-10' : 'opacity-80 hover:opacity-100'
                                )}
                                onClick={() => onMessageClick?.(item.index)}
                            >
                                {/* Connector Dot */}
                                <div className={cn(
                                    'absolute left-[7px] top-[1.3rem] w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 z-20',
                                    'bg-background shadow-sm',
                                    isActive 
                                        ? cn('border-transparent scale-125', item.dotColor) 
                                        : 'border-muted-foreground/30 group-hover:border-primary/50 group-hover:scale-110'
                                )}>
                                    {isActive && (
                                        <div className={cn(
                                            'absolute inset-0 rounded-full animate-ping opacity-75', 
                                            item.dotColor
                                        )} />
                                    )}
                                </div>

                                {/* Card */}
                                <div className={cn(
                                    'relative rounded-xl border p-3 cursor-pointer transition-all duration-200',
                                    'hover:shadow-md hover:-translate-y-0.5',
                                    isActive 
                                        ? 'bg-background border-primary/20 shadow-md ring-1 ring-primary/5' 
                                        : 'bg-card/40 border-transparent hover:bg-card hover:border-border/50'
                                )}>
                                    {/* Header */}
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <item.icon className={cn('w-3.5 h-3.5', item.iconColor, item.isThinking && 'animate-spin')} />
                                        <span className={cn('text-xs font-medium', isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                                            {item.label}
                                        </span>
                                        
                                        {/* Timestamp placeholder (could be real if data available) */}
                                        {/* <span className="text-[10px] text-muted-foreground/40 ml-auto font-mono">
                                            {item.index + 1}
                                        </span> */}
                                    </div>

                                    {/* Content Preview */}
                                    <p className={cn(
                                        'text-xs leading-relaxed line-clamp-2 font-normal',
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
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/50 text-[10px] font-medium text-accent-foreground border border-border/30"
                                                        >
                                                            <Terminal className="w-2.5 h-2.5 opacity-60" />
                                                            {tool}
                                                        </span>
                                                    ))}
                                                    {item.tools.length > 2 && (
                                                        <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                                                            +{item.tools.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {item.stats && (
                                                <div className={cn(
                                                    "flex items-center gap-1 text-[10px] text-muted-foreground/60 ml-auto font-mono",
                                                    item.toolCount === 0 && "ml-0"
                                                )}>
                                                    <Zap className="w-2.5 h-2.5" />
                                                    <span>
                                                        {((item.stats.totalTokenCount || 0) / 1000).toFixed(1)}k
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
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

