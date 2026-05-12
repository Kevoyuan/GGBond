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

export const NavListItem = React.memo(function NavListItem({ active, onClick, icon: Icon, label, count, collapsed, kbd }: NavListItemProps) {
    return (
        <button
            onClick={onClick}
            title={collapsed && kbd ? `${label} (${kbd})` : undefined}
            aria-label={`${label}${active ? ' (current)' : ''}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
                "group flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer select-none w-full text-left focus:outline-none relative overflow-hidden",
                "transition-all duration-150",
                active
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            )}
        >
            {/* Active indicator bar */}
            {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]" />
            )}

            <Icon className={cn("w-4 h-4 shrink-0 relative", active ? "stroke-[2.5]" : "stroke-[1.8] group-hover:stroke-[2.2] transition-all")} />

            {!collapsed && (
                <>
                    <span className="flex-1 text-[13px] font-medium leading-none tracking-tight">{label}</span>
                    {count !== undefined && count > 0 && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[10px] font-semibold text-[var(--text-secondary)] leading-none">
                            {count}
                        </span>
                    )}
                    {kbd && (
                        <span className="text-[10px] text-[var(--text-tertiary)] opacity-0 group-hover:opacity-60 transition-all font-mono">
                            {kbd}
                        </span>
                    )}
                </>
            )}
        </button>
    );
});
