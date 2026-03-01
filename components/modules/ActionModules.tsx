'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Terminal, Lock, FileText, ShieldCheck, Key, Loader2, CheckCircle, XCircle, Folder, File, ChevronLeft, HardDrive, Monitor, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { Select } from '@/components/ui/Select';

// ─── Module 12: Shell Permission Control ─────────────────
export const ShellManager = memo(function ShellManager() {
  const [toolsData, setToolsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sandboxMode, setSandboxMode] = useState<string>('none');
  const [headlessMode, setHeadlessMode] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/tools')
      .then(r => r.json())
      .then(data => {
        setToolsData(data);
        setSandboxMode(data.config?.sandbox || 'none');
        setHeadlessMode(data.config?.headless === true || data.config?.headless === 'true');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandbox: sandboxMode,
          headless: headlessMode
        })
      });
      if (res.ok) {
        setToolsData((prev: any) => ({
          ...prev,
          config: { ...prev.config, sandbox: sandboxMode, headless: headlessMode }
        }));
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

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
      className="h-[40rem] flex flex-col"
    >
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {/* Sandbox Mode */}
        <div className="p-3 bg-white/50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-blue-500" />
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Sandbox Mode</span>
          </div>
          <Select
            value={sandboxMode}
            onChange={setSandboxMode}
            options={[
              { id: 'none', name: 'none', description: 'Execute tools directly on host', icon: Monitor },
              { id: 'docker', name: 'docker', description: 'Run tools in isolated containers', icon: ShieldCheck }
            ]}
          />
        </div>

        {/* Headless Mode */}
        <div className="p-3 bg-white/50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Monitor size={14} className={headlessMode ? "text-emerald-500" : "text-zinc-400"} />
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Headless Mode</span>
            </div>
            <button
              onClick={() => setHeadlessMode(!headlessMode)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                headlessMode ? "bg-emerald-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" : "bg-zinc-300 dark:bg-zinc-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm",
                headlessMode ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Auto-approve all safe tool executions. Disable interactive confirmations.
          </p>
        </div>

        {/* Save Button */}
        {(sandboxMode !== (config.sandbox || 'none') || headlessMode !== (config.headless === true || config.headless === 'true')) && (
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="w-full h-9 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Dangerous Tools */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/20 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5 px-1">
              <Lock size={10} /> Require Approval ({dangerousTools.length})
            </h4>
            <div className="space-y-[2px]">
              {dangerousTools.map((tool: any) => (
                <div key={tool.name} className="flex items-center justify-between py-1 px-1.5 rounded bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/30 dark:border-zinc-800/30 shadow-[0_1px_1px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate">{tool.name}</span>
                  {tool.isExcluded ? (
                    <XCircle size={12} className="text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle size={12} className="text-amber-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Safe Tools */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/20 p-2 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5 px-1">
              <CheckCircle size={10} /> Auto-Approved ({safeTools.length})
            </h4>
            <div className="space-y-[2px]">
              {safeTools.map((tool: any) => (
                <div key={tool.name} className="flex items-center justify-between py-1 px-1.5 rounded bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/30 dark:border-zinc-800/30 shadow-[0_1px_1px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate">{tool.name}</span>
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shell Config */}
        {config.shell && Object.keys(config.shell).length > 0 && (
          <div className="p-3 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 space-y-2">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Terminal size={10} /> Shell Environment
            </h4>
            <div className="space-y-1">
              {Object.entries(config.shell).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-1">
                  <span className="text-xs text-zinc-500 font-medium">{k}</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 text-[10px] bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded shadow-sm border border-zinc-200/50 dark:border-zinc-700/50">{String(v)}</span>
                </div>
              ))}
            </div>
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
    <ModuleCard
      title="Authentication"
      description={authTypeLabels[auth.type] || auth.type}
      icon={Key}
      className="h-[40rem] flex flex-col"
    >
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {/* Auth Type Badge */}
        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200/50 dark:border-emerald-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={16} />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Authenticated</div>
              <div className="text-xs font-mono text-emerald-700/80 dark:text-emerald-400/80">{authTypeLabels[auth.type] || auth.type}</div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        {auth.accounts && auth.accounts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 px-1">Linked Profiles</h4>
            <div className="space-y-1.5">
              {auth.accounts.map((acc, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg bg-white/50 dark:bg-zinc-900/30 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold ring-2 ring-white dark:ring-zinc-900 shadow-sm shrink-0">
                    {(acc.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    {acc.displayName && <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{acc.displayName}</div>}
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono opacity-80">{acc.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className={cn(
            "px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            auth.hasOAuthCreds
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-zinc-50 text-zinc-500 border-zinc-200/50 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-800"
          )}>
            OAuth {auth.hasOAuthCreds ? 'Active' : 'Missing'}
          </span>
          <span className={cn(
            "px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            auth.hasApiKey
              ? "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
              : "bg-zinc-50 text-zinc-500 border-zinc-200/50 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-800"
          )}>
            API Key {auth.hasApiKey ? 'Loaded' : 'Missing'}
          </span>
        </div>

        {/* IDs */}
        <div className="space-y-1 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
          {auth.userId && (
            <div className="flex justify-between items-center py-1.5 text-sm p-2 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/20 border border-transparent hover:border-zinc-200/30 dark:hover:border-zinc-800/30">
              <span className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold">User Identity</span>
              <Tooltip content={auth.userId} side="top">
                <span className="font-mono text-[10px] text-zinc-800 dark:text-zinc-200 max-w-[150px] truncate bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-zinc-200/30 dark:border-zinc-700/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                  {auth.userId}
                </span>
              </Tooltip>
            </div>
          )}
          {auth.accountId && (
            <div className="flex justify-between items-center py-1.5 text-sm p-2 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/20 border border-transparent hover:border-zinc-200/30 dark:hover:border-zinc-800/30">
              <span className="text-zinc-500 text-[9px] uppercase tracking-widest font-bold">Account Root</span>
              <Tooltip content={auth.accountId} side="top">
                <span className="font-mono text-[10px] text-zinc-800 dark:text-zinc-200 max-w-[150px] truncate bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-zinc-200/30 dark:border-zinc-700/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
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
