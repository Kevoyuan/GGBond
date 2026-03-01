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
      "group relative flex flex-col h-full overflow-hidden rounded-xl transition-all duration-300",
      "bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md",
      "border border-zinc-200/50 dark:border-zinc-800/50",
      "shadow-sm hover:shadow-md dark:shadow-none",
      className
    )}>
      <div className="flex items-center justify-between p-4 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "p-2 rounded-lg transition-colors duration-300",
            "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
            "group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400"
          )}>
            <Icon size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{title}</h3>
            {description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-medium">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1 pl-2 shrink-0">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col p-4 overflow-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {children}
      </div>
    </div>
  );
});
