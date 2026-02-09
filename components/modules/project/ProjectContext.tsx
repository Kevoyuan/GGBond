import React from 'react';
import { ModuleCard } from '../ModuleCard';
import { FileCode, FolderGit2, RefreshCw, Eye, Edit3 } from 'lucide-react';
import { mockContext } from '@/lib/api/gemini-mock';

export function ProjectContext() {
  const context = mockContext;

  return (
    <ModuleCard 
      title="Project Context" 
      description="Active rules and file indexing" 
      icon={FolderGit2}
      actions={
        <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-6">
        {/* GEMINI.md Section */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-medium text-sm">
              <FileCode size={16} />
              GEMINI.md
            </div>
            <div className="flex gap-1">
              <button className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded text-amber-700 dark:text-amber-300">
                <Eye size={14} />
              </button>
              <button className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded text-amber-700 dark:text-amber-300">
                <Edit3 size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/70 line-clamp-2">
            Project-specific rules: Next.js 14 App Router, Tailwind CSS, Lucide Icons. Always use strict TypeScript.
          </p>
        </div>

        {/* Index Status */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Indexed Files</h4>
          <div className="space-y-2">
            {context.memoryFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50 transition-colors group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCode size={14} className="text-muted-foreground shrink-0" />
                  <span className="truncate font-mono text-xs">{file.path.split('/').pop()}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    file.status === 'active' 
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                  }`}>
                    {file.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-2xl font-bold text-foreground">{context.totalIndexedFiles}</div>
            <div className="text-xs text-muted-foreground">Files Indexed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">{context.contextSize}</div>
            <div className="text-xs text-muted-foreground">Context Size</div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
