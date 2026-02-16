
import React from 'react';
import { GeminiIcon } from './icons/GeminiIcon';
import { cn } from '@/lib/utils';

export function StreamingIndicator({ status, className }: { status?: string; className?: string }) {
    return (
        <div className={cn("inline-flex items-center gap-2 animate-in fade-in duration-300 pl-0.5", className)}>
            <div className="relative flex items-center justify-center w-5 h-5 ml-[-4px]">
                <GeminiIcon className="w-[11px] h-[11px] animate-pulse relative z-10 drop-shadow-[0_0_1.2px_rgba(74,169,255,0.8)]" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-transparent select-none font-bold animate-shimmer bg-linear-to-r from-muted-foreground/30 via-foreground to-muted-foreground/30 bg-[length:200%_100%] bg-clip-text">
                {status || 'Generating'}
            </span>
        </div>
    );
}
