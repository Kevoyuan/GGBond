'use client';

import React, { useEffect, useState, memo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Hammer, Server, Puzzle, RefreshCw, Plus, Trash2, Loader2, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

// ─── Module 5: Tool Manager (Built-in Tools) ────────────
interface ToolInfo {
  name: string;
  displayName: string;
  requiresApproval: boolean;
  enabled: boolean;
  isCore: boolean;
  isAllowed: boolean;
  isExcluded: boolean;
}

export const ToolManager = memo(function ToolManager() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [config, setConfig] = useState<{ sandbox: string; approvalMode: string }>({ sandbox: 'none', approvalMode: 'default' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tools')
      .then(r => r.json())
      .then(data => {
        setTools(data.tools || []);
        setConfig(data.config || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ModuleCard title="Built-in Tools" description="Gemini CLI tool status" icon={Hammer}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="Built-in Tools"
      description={`Sandbox: ${config.sandbox} · Approval: ${config.approvalMode}`}
      icon={Hammer}
      className="h-[30rem] flex flex-col"
    >
      <div className="flex-1 min-h-[0] overflow-y-auto space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {tools.map(tool => (
          <div key={tool.name} className="flex items-center justify-between p-2 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg bg-white/50 dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] dark:hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-300 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{tool.name}</span>
                {tool.requiresApproval && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-widest bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 rounded-sm border border-amber-200 dark:border-amber-500/20">
                    Approval
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate opacity-80">{tool.displayName}</span>
            </div>
            <div className="shrink-0 ml-2">
              {tool.isExcluded ? (
                <span className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded-sm border border-red-200 dark:border-red-500/20"><XCircle size={10} /> Excluded</span>
              ) : tool.isCore ? (
                <span className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-sm border border-blue-200 dark:border-blue-500/20"><CheckCircle size={10} /> Core</span>
              ) : (
                <span className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-sm border border-emerald-200 dark:border-emerald-500/20 transition-colors"><CheckCircle size={10} /> Active</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
});

// ─── Module 2: MCP Server Manager ────────────────────────
interface MCPServer {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  timeout?: number;
}

export const MCPManager = memo(function MCPManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');

  const fetchServers = () => {
    fetch('/api/mcp')
      .then(r => r.json())
      .then(data => setServers(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchServers(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: newName.trim(),
          config: {
            command: newCommand.trim() || undefined,
            args: newArgs.trim() ? newArgs.split(',').map(a => a.trim()) : undefined,
          },
        }),
      });
      setNewName(''); setNewCommand(''); setNewArgs(''); setShowAdd(false);
      fetchServers();
    } catch (err) { console.error('Failed to add server:', err); }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove MCP server "${name}"?`)) return;
    try {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', name }),
      });
      fetchServers();
    } catch (err) { console.error('Failed to remove server:', err); }
  };

  if (loading) {
    return (
      <ModuleCard title="MCP Servers" description="Model Context Protocol" icon={Server}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard
      title="MCP Servers"
      description={`${servers.length} configured`}
      icon={Server}
      actions={
        <button onClick={fetchServers} className="p-1.5 text-zinc-500 hover:text-blue-600 transition-colors" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        {servers.length === 0 ? (
          <div className="text-center py-6 text-xs font-bold uppercase tracking-widest text-zinc-400">No MCP servers configured</div>
        ) : (
          servers.map(server => (
            <div key={server.name} className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-lg border border-zinc-200 dark:border-zinc-800 group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{server.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate opacity-80">
                    {server.command ? `${server.command} ${server.args?.join(' ') || ''}` : server.url || 'No command set'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {server.timeout && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">{server.timeout / 1000}s</span>}
                <button
                  onClick={() => handleRemove(server.name)}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}

        {showAdd ? (
          <div className="p-3 border border-blue-200 dark:border-blue-900/30 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 space-y-2 animate-in fade-in slide-in-from-top-2">
            <input
              value={newName} onChange={e => setNewName(e.target.value)} placeholder="Server name"
              className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            />
            <input
              value={newCommand} onChange={e => setNewCommand(e.target.value)} placeholder="Command (e.g. npx)"
              className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
            />
            <input
              value={newArgs} onChange={e => setNewArgs(e.target.value)} placeholder="Args (comma separated)"
              className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none transition-colors font-mono"
            />
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} className="flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm">Add Server</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-1.5 text-[10px] uppercase font-bold tracking-wider border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={14} /> Add MCP Server
          </button>
        )}
      </div>
    </ModuleCard>
  );
});

// ─── Module 9: Extension Manager ─────────────────────────
interface Extension {
  name: string;
  description: string;
}

export const ExtensionManager = memo(function ExtensionManager() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [installUrl, setInstallUrl] = useState('');

  const fetchExtensions = () => {
    fetch('/api/extensions')
      .then(r => r.json())
      .then(data => setExtensions(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchExtensions(); }, []);

  const handleInstall = async () => {
    if (!installUrl.trim()) return;
    try {
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', source: installUrl.trim() }),
      });
      setInstallUrl('');
      fetchExtensions();
    } catch (err) { console.error('Install failed:', err); }
  };

  const handleUninstall = async (name: string) => {
    if (!confirm(`Uninstall extension "${name}"?`)) return;
    try {
      await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uninstall', name }),
      });
      fetchExtensions();
    } catch (err) { console.error('Uninstall failed:', err); }
  };

  if (loading) {
    return (
      <ModuleCard title="Extensions" description="CLI extensions" icon={Puzzle}>
        <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
      </ModuleCard>
    );
  }

  return (
    <ModuleCard title="Extensions" description={`${extensions.length} installed`} icon={Puzzle}>
      <div className="space-y-3">
        {extensions.length === 0 ? (
          <div className="text-center py-6 text-xs font-bold uppercase tracking-widest text-zinc-400">No extensions installed</div>
        ) : (
          extensions.map(ext => (
            <div key={ext.name} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
              <div className="min-w-0">
                <div className="font-medium text-sm text-foreground">{ext.name}</div>
                {ext.description && <div className="text-xs text-muted-foreground truncate">{ext.description}</div>}
              </div>
              <button
                onClick={() => handleUninstall(ext.name)}
                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}

        <div className="flex gap-2">
          <input
            value={installUrl}
            onChange={e => setInstallUrl(e.target.value)}
            placeholder="Extension URL or path..."
            className="flex-1 px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-transparent focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
          />
          <button
            onClick={handleInstall}
            disabled={!installUrl.trim()}
            className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </ModuleCard>
  );
});
