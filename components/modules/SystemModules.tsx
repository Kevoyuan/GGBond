import React, { useEffect, useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Hammer, Server, Puzzle, RefreshCw, Plus, MessageSquare, Terminal, Trash2, Power, Download, X } from 'lucide-react';
import { fetchMCPServers, fetchSessions, fetchTools, fetchExtensions, toggleTool, addMCPServer, removeMCPServer, toggleMCPServer, installExtension, uninstallExtension } from '@/lib/api/gemini';
import { MCPServer, Session, Tool, Extension } from '@/lib/types/gemini';
import { formatDistanceToNow } from 'date-fns';

export function ChatManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentSession = sessions[0]; // Assuming first is most recent

  return (
    <ModuleCard title="Chat Sessions" description="Manage active conversations" icon={MessageSquare}>
      <div className="space-y-3">
        {loading ? (
            <div className="text-xs text-zinc-500 text-center py-4">Loading sessions...</div>
        ) : currentSession ? (
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="flex flex-col">
                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]" title={currentSession.title}>
                    {currentSession.title || 'Current Session'}
                </span>
                <span className="text-xs text-zinc-500">ID: {currentSession.id.substring(0, 8)}...</span>
                </div>
            </div>
            <span className="text-xs font-mono text-zinc-500">
                {currentSession.updated_at ? formatDistanceToNow(new Date(currentSession.updated_at), { addSuffix: true }) : 'Active'}
            </span>
            </div>
        ) : (
            <div className="text-xs text-zinc-500 text-center py-4">No active sessions</div>
        )}
        <div className="grid grid-cols-2 gap-2">
           <button className="p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
             Clear History
           </button>
           <button className="p-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
             Export Log
           </button>
        </div>
      </div>
    </ModuleCard>
  );
}

export function ShellManager() {
  return (
    <ModuleCard title="Shell Integration" description="Terminal environment & PTY" icon={Terminal}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Default Shell</span>
          <select className="bg-transparent text-sm font-medium text-zinc-900 dark:text-zinc-100 border-none outline-none">
            <option>/bin/zsh</option>
            <option>/bin/bash</option>
            <option>/usr/bin/fish</option>
          </select>
        </div>
        <div className="h-24 bg-zinc-950 rounded-lg p-3 font-mono text-xs text-zinc-400 overflow-hidden">
          <div className="flex gap-2">
            <span className="text-green-500">➜</span>
            <span className="text-blue-400">~</span>
            <span>gemini --version</span>
          </div>
          <div className="mt-1">gemini-cli version 1.2.0</div>
          <div className="flex gap-2 mt-1">
             <span className="text-green-500">➜</span>
             <span className="text-blue-400">~</span>
             <span className="animate-pulse">_</span>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}

export function ToolManager() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchTools()
      .then(setTools)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (name: string, enabled: boolean) => {
    if (toggling) return;
    setToggling(name);
    try {
        await toggleTool(name, !enabled);
        setTools(prev => prev.map(t => t.name === name ? { ...t, enabled: !enabled } : t));
    } catch (error) {
        console.error('Failed to toggle tool:', error);
        alert('Failed to toggle tool. Check console for details.');
    } finally {
        setToggling(null);
    }
  };

  return (
    <ModuleCard title="Tool Management" description="Configure built-in tools" icon={Hammer}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
             <div className="col-span-2 text-xs text-zinc-500 text-center py-4">Loading tools...</div>
        ) : tools.length > 0 ? (
            tools.slice(0, 6).map((tool) => (
            <div key={tool.name} className="flex items-start justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[100px]" title={tool.name}>{tool.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-[120px]">{tool.description}</div>
                </div>
                <button 
                  onClick={() => handleToggle(tool.name, tool.enabled)}
                  disabled={!!toggling}
                  className={`w-8 h-4 rounded-full relative transition-colors ${tool.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'} ${toggling === tool.name ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${tool.enabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: tool.enabled ? '18px' : '2px' }} />
                </button>
            </div>
            ))
        ) : (
            <div className="col-span-2 text-xs text-zinc-500 text-center py-4">No tools found</div>
        )}
      </div>
    </ModuleCard>
  );
}

export function MCPManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [newServerArgs, setNewServerArgs] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchMCPServers()
      .then(setServers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newServerName || !newServerCommand) return;
      
      setProcessing(true);
      try {
          const config = {
              command: newServerCommand,
              args: newServerArgs ? newServerArgs.split(' ') : []
          };
          await addMCPServer(newServerName, config);
          setShowAddForm(false);
          setNewServerName('');
          setNewServerCommand('');
          setNewServerArgs('');
          loadData();
      } catch (error) {
          console.error('Failed to add server:', error);
          alert('Failed to add server');
      } finally {
          setProcessing(false);
      }
  };

  const handleRemove = async (name: string) => {
      if (!confirm(`Are you sure you want to remove ${name}?`)) return;
      setProcessing(true);
      try {
          await removeMCPServer(name);
          loadData();
      } catch (error) {
          console.error('Failed to remove server:', error);
          alert('Failed to remove server');
      } finally {
          setProcessing(false);
      }
  };

  return (
    <ModuleCard 
      title="MCP Servers" 
      description="Model Context Protocol integrations" 
      icon={Server}
      actions={
        <button 
          onClick={loadData}
          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" 
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="space-y-3">
        {servers.map((server) => (
          <div key={server.name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} title={server.error || server.status} />
              <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{server.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">{server.toolsCount} tools</span>
              <button onClick={() => handleRemove(server.name)} disabled={processing} className="text-zinc-400 hover:text-red-500">
                  <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        
        {showAddForm ? (
            <form onSubmit={handleAdd} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg space-y-2">
                <input 
                    type="text" 
                    placeholder="Server Name" 
                    value={newServerName} 
                    onChange={e => setNewServerName(e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-transparent"
                    required
                />
                <input 
                    type="text" 
                    placeholder="Command (e.g. npx -y @modelcontextprotocol/server-filesystem)" 
                    value={newServerCommand} 
                    onChange={e => setNewServerCommand(e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-transparent"
                    required
                />
                <input 
                    type="text" 
                    placeholder="Args (optional)" 
                    value={newServerArgs} 
                    onChange={e => setNewServerArgs(e.target.value)}
                    className="w-full text-xs p-1.5 border border-zinc-200 dark:border-zinc-700 rounded bg-transparent"
                />
                <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowAddForm(false)} className="text-xs px-2 py-1 text-zinc-500">Cancel</button>
                    <button type="submit" disabled={processing} className="text-xs px-2 py-1 bg-zinc-900 text-white rounded">
                        {processing ? 'Adding...' : 'Add'}
                    </button>
                </div>
            </form>
        ) : (
            <button 
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2"
            >
            <Plus size={14} /> Add Server
            </button>
        )}
      </div>
    </ModuleCard>
  );
}

export function ExtensionManager() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallInput, setShowInstallInput] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadExtensions = () => {
      setLoading(true);
      fetchExtensions()
        .then(setExtensions)
        .catch(console.error)
        .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const handleInstall = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!installUrl) return;
      setProcessing(true);
      try {
          await installExtension(installUrl);
          setInstallUrl('');
          setShowInstallInput(false);
          loadExtensions();
      } catch (error) {
          console.error('Failed to install extension:', error);
          alert('Failed to install extension');
      } finally {
          setProcessing(false);
      }
  };

  const handleUninstall = async (name: string) => {
      if (!confirm(`Uninstall ${name}?`)) return;
      setProcessing(true);
      try {
          await uninstallExtension(name);
          loadExtensions();
      } catch (error) {
          console.error('Failed to uninstall extension:', error);
          alert('Failed to uninstall extension');
      } finally {
          setProcessing(false);
      }
  };

  return (
    <ModuleCard title="Extensions" description="Manage CLI extensions" icon={Puzzle}>
      <div className="space-y-3">
        {loading ? (
             <div className="text-center py-8 text-zinc-500 text-sm">Loading extensions...</div>
        ) : extensions.length > 0 ? (
            extensions.map((ext) => (
            <div key={ext.name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                <div className="flex flex-col">
                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{ext.name}</span>
                <span className="text-xs text-zinc-500">v{ext.version}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`text-xs px-2 py-1 rounded ${ext.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-100 text-zinc-600'}`}>
                    {ext.status}
                    </div>
                    <button onClick={() => handleUninstall(ext.name)} disabled={processing} className="text-zinc-400 hover:text-red-500">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            ))
        ) : (
            <div className="text-center py-8 text-zinc-500 text-sm">
                No extensions installed.
            </div>
        )}
        
        {showInstallInput ? (
            <form onSubmit={handleInstall} className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="Extension URL or Path" 
                    value={installUrl} 
                    onChange={e => setInstallUrl(e.target.value)}
                    className="flex-1 text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-transparent"
                    required
                />
                <button type="submit" disabled={processing} className="text-xs px-3 py-1 bg-zinc-900 text-white rounded">
                    {processing ? '...' : 'Install'}
                </button>
                <button type="button" onClick={() => setShowInstallInput(false)} className="text-xs px-2 py-1 text-zinc-500">
                    <X size={14} />
                </button>
            </form>
        ) : (
            <button onClick={() => setShowInstallInput(true)} className="w-full text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                <Download size={12} /> Install from URL
            </button>
        )}
      </div>
    </ModuleCard>
  );
}
