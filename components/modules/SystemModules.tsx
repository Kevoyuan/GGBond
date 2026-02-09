import React from 'react';
import { ModuleCard } from './ModuleCard';
import { Hammer, Server, Puzzle, RefreshCw, Plus, MessageSquare, Terminal } from 'lucide-react';
import { mockMCPServers } from '@/lib/api/gemini-mock';

export function ChatManager() {
  return (
    <ModuleCard title="Chat Sessions" description="Manage active conversations" icon={MessageSquare}>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="flex flex-col">
              <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Current Session</span>
              <span className="text-xs text-zinc-500">ID: sess_8a92b3...</span>
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-500">Active 12m</span>
        </div>
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
  const tools = [
    { name: 'read_file', description: 'Read file content', enabled: true },
    { name: 'write_file', description: 'Write content to file', enabled: true },
    { name: 'run_command', description: 'Execute shell commands', enabled: true },
    { name: 'browser', description: 'Headless browser automation', enabled: false },
  ];

  return (
    <ModuleCard title="Tool Management" description="Configure built-in tools" icon={Hammer}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <div key={tool.name} className="flex items-start justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">{tool.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{tool.description}</div>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${tool.enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${tool.enabled ? 'left-4.5' : 'left-0.5'}`} style={{ left: tool.enabled ? '18px' : '2px' }} />
            </div>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

export function MCPManager() {
  const servers = mockMCPServers;

  return (
    <ModuleCard 
      title="MCP Servers" 
      description="Model Context Protocol integrations" 
      icon={Server}
      actions={
        <button className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" title="Refresh">
          <RefreshCw size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        {servers.map((server) => (
          <div key={server.name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{server.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">{server.toolsCount} tools</span>
              <button className="text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700">Config</button>
            </div>
          </div>
        ))}
        <button className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2">
          <Plus size={14} /> Add Server
        </button>
      </div>
    </ModuleCard>
  );
}

export function ExtensionManager() {
  return (
    <ModuleCard title="Extensions" description="Manage CLI extensions" icon={Puzzle}>
      <div className="text-center py-8 text-zinc-500 text-sm">
        No extensions installed.
        <br />
        <button className="mt-2 text-blue-600 hover:underline">Browse Marketplace</button>
      </div>
    </ModuleCard>
  );
}
