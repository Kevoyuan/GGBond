import React from 'react';
import { cn } from '@/lib/utils';

interface NavListItemProps {
    active: boolean;
    onClick: () => void;
    icon: React.ElementType;
    label: string;
    count?: number;
    collapsed?: boolean; // We might not need this if we rely on the parent width, but keeping for compatibility
    kbd?: string;
}

export function NavListItem({ active, onClick, icon: Icon, label, count, collapsed, kbd }: NavListItemProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "group flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-all duration-150 select-none",
                active
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
        >
            <Icon className={cn("w-4 h-4 shrink-0", active ? "stroke-[2]" : "stroke-[1.8]")} />

            {!collapsed && (
                <>
                    <span className="flex-1 text-[13px] font-medium leading-none">{label}</span>
                    {count !== undefined && count > 0 && (
                        <span className="text-[11px] text-[var(--text-tertiary)] font-normal">{count}</span>
                    )}
                    {kbd && (
                        <span className="text-[10px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                            {kbd}
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
