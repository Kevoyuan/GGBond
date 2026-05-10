import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ModuleCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const ModuleCard = React.memo(function ModuleCard({ title, description, icon: Icon, className, children, actions }: ModuleCardProps) {
  return (
    <div className={cn(
      "group relative flex flex-col h-full overflow-hidden rounded-[var(--radius-lg)] transition-colors duration-300",
      "bg-[var(--bg-secondary)] backdrop-blur-md",
      "border border-[var(--border-subtle)]",
      "shadow-sm hover:shadow-md",
      className
    )}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "p-2 rounded-[var(--radius-md)] transition-colors duration-300",
            "bg-[var(--bg-hover)] text-[var(--text-secondary)]",
            "group-hover:bg-[var(--accent-subtle)] group-hover:text-[var(--accent)]"
          )}>
            <Icon size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1 pl-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent">
        {children}
      </div>
    </div>
  );
});
