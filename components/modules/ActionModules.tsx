'use client';

import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Terminal, Lock, FileText, ShieldCheck, Key, Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

// ─── Module 12: Shell Permission Control ─────────────────
export function ShellManager() {
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
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="font-medium text-sm">Sandbox Mode</span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${config.sandbox === 'docker'
                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
                : config.sandbox === 'none'
                  ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/40'
                  : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}>
              {config.sandbox || 'none'}
            </span>
          </div>
        </div>

        {/* Dangerous Tools (require approval) */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Lock size={12} /> Require Approval ({dangerousTools.length})
          </h4>
          <div className="space-y-1">
            {dangerousTools.map((tool: any) => (
              <div key={tool.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span className="text-sm font-mono text-foreground">{tool.name}</span>
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
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle size={12} /> Auto-Approved ({safeTools.length})
          </h4>
          <div className="space-y-1">
            {safeTools.map((tool: any) => (
              <div key={tool.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <span className="text-sm font-mono text-foreground">{tool.name}</span>
                <CheckCircle size={14} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Shell Config */}
        {config.shell && Object.keys(config.shell).length > 0 && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Shell Config</h4>
            {Object.entries(config.shell).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-1.5 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-foreground text-xs">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}

// ─── Module 6: Auth Manager ──────────────────────────────
interface AuthInfo {
  type: string;
  accountId?: string;
  accounts?: { email: string; displayName?: string }[];
  userId?: string;
  hasOAuthCreds: boolean;
  hasApiKey: boolean;
}

export function AuthManager() {
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
      <div className="space-y-3">
        {/* Auth Type Badge */}
        <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
            <div>
              <div className="font-medium text-sm text-green-800 dark:text-green-200">Authenticated</div>
              <div className="text-xs text-green-600 dark:text-green-400">{authTypeLabels[auth.type] || auth.type}</div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        {auth.accounts && auth.accounts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Linked Accounts</h4>
            {auth.accounts.map((acc, i) => (
              <div key={i} className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 text-sm font-bold">
                  {(acc.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  {acc.displayName && <div className="text-sm font-medium text-foreground truncate">{acc.displayName}</div>}
                  <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2 py-1 text-xs rounded-full border ${auth.hasOAuthCreds
              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
              : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
            }`}>
            OAuth: {auth.hasOAuthCreds ? '✓' : '✗'}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full border ${auth.hasApiKey
              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/40'
              : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
            }`}>
            API Key: {auth.hasApiKey ? '✓' : '✗'}
          </span>
        </div>

        {/* IDs */}
        <div className="space-y-1 pt-2 border-t border-border">
          {auth.userId && (
            <div className="flex justify-between items-center py-1 text-sm">
              <span className="text-muted-foreground text-xs">User ID</span>
              <span className="font-mono text-xs text-foreground max-w-[180px] truncate">{auth.userId}</span>
            </div>
          )}
          {auth.accountId && (
            <div className="flex justify-between items-center py-1 text-sm">
              <span className="text-muted-foreground text-xs">Account ID</span>
              <span className="font-mono text-xs text-foreground max-w-[180px] truncate">{auth.accountId}</span>
            </div>
          )}
        </div>
      </div>
    </ModuleCard>
  );
}

// ─── Module 15: File Manager ─────────────────────────────
export function FileManager() {
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
    if (type === 'directory') return '📁';
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext || '')) return '📄';
    if (['.json', '.yaml', '.yml'].includes(ext || '')) return '⚙️';
    if (['.md', '.txt'].includes(ext || '')) return '📝';
    return '📄';
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
            className="w-full text-left py-1.5 px-2 text-sm text-blue-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded transition-colors"
          >
            ← ..
          </button>
        )}
        <div className="max-h-[300px] overflow-y-auto space-y-0.5">
          {files.slice(0, 30).map(file => (
            <button
              key={file.path}
              onClick={() => file.type === 'directory' && fetchFiles(file.path)}
              className={`w-full text-left py-1.5 px-2 text-sm rounded flex items-center gap-2 transition-colors ${file.type === 'directory'
                  ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer text-foreground'
                  : 'text-muted-foreground cursor-default'
                }`}
            >
              <span>{getIcon(file.type, file.extension)}</span>
              <span className="truncate">{file.name}</span>
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border font-mono">
          {currentPath}
        </div>
      </div>
    </ModuleCard>
  );
}
