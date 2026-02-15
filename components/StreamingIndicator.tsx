
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StreamingIndicator({ status, className }: { status?: string; className?: string }) {
    return (
        <div className={cn("inline-flex items-center gap-1.5 animate-in fade-in duration-300", className)}>
            <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground select-none font-medium">
                {status || 'Generating'}
            </span>
        </div>
    );
}
