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

export function ModuleCard({ title, description, icon: Icon, className, children, actions }: ModuleCardProps) {
  return (
    <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full", className)}>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-lg leading-none text-zinc-900 dark:text-zinc-100">{title}</h3>
            {description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}
