'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Terminal, Lock, FileText, ShieldCheck, Key, Loader2, Eye, EyeOff, CheckCircle, XCircle, Folder, File, ChevronLeft, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

// ─── Module 12: Shell Permission Control ─────────────────
export const ShellManager = memo(function ShellManager() {
  const [toolsData, setToolsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tools')
      .then(r => r.json())
      .then(setToolsData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Shell & Permissions" description="Tool access control" icon={Terminal}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  const config = toolsData?.config || {};
  const tools = toolsData?.tools || [];
  const dangerousTools = tools.filter((t: any) => t.requiresApproval);
  const safeTools = tools.filter((t: any) => !t.requiresApproval);

  return (
    <ModuleCard
      title="Shell & Permissions"
      description={`Sandbox: ${config.sandbox || 'none'}`}
      icon={Terminal}
    >
      <div className="space-y-4">
        {/* Sandbox Mode */}
        <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200/50 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="font-medium text-sm">Sandbox Mode</span>
            </div>
            <span className={cn(
              "px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border",
              config.sandbox === 'docker'
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                : config.sandbox === 'none'
                  ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                  : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            )}>
              {config.sandbox || 'none'}
            </span>
          </div>
        </div>

        {/* Dangerous Tools (require approval) */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
            <Lock size={10} /> Require Approval ({dangerousTools.length})
          </h4>
          <div className="space-y-1">
            {dangerousTools.map((tool: any) => (
              <div key={tool.name} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800">
                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{tool.name}</span>
                {tool.isExcluded ? (
                  <XCircle size={14} className="text-red-500" />
                ) : (
                  <CheckCircle size={14} className="text-amber-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Safe Tools */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
            <CheckCircle size={10} /> Auto-Approved ({safeTools.length})
          </h4>
          <div className="space-y-1">
            {safeTools.map((tool: any) => (
              <div key={tool.name} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800">
                <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{tool.name}</span>
                <CheckCircle size={14} className="text-emerald-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Shell Config */}
        {config.shell && Object.keys(config.shell).length > 0 && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Shell Config</h4>
            {Object.entries(config.shell).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-1.5 text-sm group">
                <span className="text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">{k}</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100 text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleCard>
  );
});

// ─── Module 6: Auth Manager ──────────────────────────────
interface AuthInfo {
  type: string;
  accountId?: string;
  accounts?: { email: string; displayName?: string }[];
  userId?: string;
  hasOAuthCreds: boolean;
  hasApiKey: boolean;
}

export const AuthManager = memo(function AuthManager() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.json())
      .then(setAuth)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Authentication" description="Account status" icon={Key}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  if (!auth) return null;

  const authTypeLabels: Record<string, string> = {
    'oauth-personal': 'Google OAuth (Personal)',
    'gemini-api-key': 'API Key',
    'vertex-ai': 'Vertex AI',
    'adc': 'Application Default Credentials',
  };

  return (
    <ModuleCard title="Authentication" description={authTypeLabels[auth.type] || auth.type} icon={Key}>
      <div className="space-y-4">
        {/* Auth Type Badge */}
        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200/50 dark:border-emerald-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">Authenticated</div>
              <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80">{authTypeLabels[auth.type] || auth.type}</div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        {auth.accounts && auth.accounts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Linked Accounts</h4>
            {auth.accounts.map((acc, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold ring-2 ring-white dark:ring-zinc-900 shadow-sm">
                  {(acc.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  {acc.displayName && <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{acc.displayName}</div>}
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">{acc.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className={cn(
            "px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border transition-colors",
            auth.hasOAuthCreds
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
          )}>
            OAuth: {auth.hasOAuthCreds ? '✓' : '✗'}
          </span>
          <span className={cn(
            "px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border transition-colors",
            auth.hasApiKey
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
          )}>
            API Key: {auth.hasApiKey ? '✓' : '✗'}
          </span>
        </div>

        {/* IDs */}
        <div className="space-y-1 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          {auth.userId && (
            <div className="flex justify-between items-center py-1 text-sm">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">User ID</span>
              <Tooltip content={auth.userId} side="top">
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 max-w-[150px] truncate bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded cursor-help">
                  {auth.userId}
                </span>
              </Tooltip>
            </div>
          )}
          {auth.accountId && (
            <div className="flex justify-between items-center py-1 text-sm">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Account ID</span>
              <Tooltip content={auth.accountId} side="top">
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 max-w-[150px] truncate bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded cursor-help">
                  {auth.accountId}
                </span>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </ModuleCard>
  );
});

// ─── Module 15: File Manager ─────────────────────────────
export const FileManager = memo(function FileManager() {
  const [files, setFiles] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchFiles = (p?: string) => {
    setLoading(true);
    const url = p ? `/api/files?path=${encodeURIComponent(p)}&ignore=0` : '/api/files?ignore=0';
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setFiles(data.files || []);
        setCurrentPath(data.path || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFiles(); }, []);

  const getIcon = (type: string, ext: string | null) => {
    if (type === 'directory') return <Folder size={14} className="text-blue-500 fill-blue-500/20" />;
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext || '')) return <FileText size={14} className="text-amber-500" />;
    if (['.json', '.yaml', '.yml'].includes(ext || '')) return <HardDrive size={14} className="text-purple-500" />;
    if (['.md', '.txt'].includes(ext || '')) return <FileText size={14} className="text-zinc-500" />;
    return <File size={14} className="text-zinc-400" />;
  };

  if (loading) {
    return (
      <ModuleCard title="File Explorer" description="Browse workspace" icon={FileText}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="File Explorer" description={currentPath.split('/').pop() || 'root'} icon={FileText}>
      <div className="space-y-1">
        {currentPath && currentPath !== '/' && (
          <button
            onClick={() => fetchFiles(currentPath.split('/').slice(0, -1).join('/'))}
            className="w-full text-left py-1.5 px-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors flex items-center gap-2 font-medium"
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <div className="max-h-[300px] overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800 pr-1">
          {files.slice(0, 30).map(file => (
            <button
              key={file.path}
              onClick={() => file.type === 'directory' && fetchFiles(file.path)}
              className={cn(
                "w-full text-left py-1.5 px-2 text-sm rounded-md flex items-center gap-2 transition-all duration-200 group border border-transparent",
                file.type === 'directory'
                  ? "hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer text-zinc-900 dark:text-zinc-100 hover:border-blue-100 dark:hover:border-blue-900/30"
                  : "text-zinc-500 dark:text-zinc-400 cursor-default hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
              )}
            >
              <span className="shrink-0">{getIcon(file.type, file.extension)}</span>
              <span className="truncate font-medium">{file.name}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-zinc-400 text-center pt-2 border-t border-zinc-200 dark:border-zinc-800 font-mono truncate px-2 opacity-60">
          {currentPath}
        </div>
      </div>
    </ModuleCard>
  );
});
