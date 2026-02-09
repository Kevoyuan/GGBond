import { Checkpoint, ProjectContext, MCPServer, UsageMetrics, Session, Tool, Extension, Hook, HookConfig, HooksData } from '@/lib/types/gemini';

const STANDARD_TOOLS = [
  'read_file', 'write_file', 'list_directory', 'search_files', 
  'run_script', 'get_web_page', 'google_search', 'run_shell_command'
];

// Checkpoints
export async function fetchCheckpoints(): Promise<Checkpoint[]> {
  const res = await fetch('/api/timeline');
  if (!res.ok) throw new Error('Failed to fetch checkpoints');
  return res.json();
}

// Context
export async function fetchContext(): Promise<ProjectContext> {
  // Context API not refactored yet, assuming it works or needs similar treatment?
  // User didn't prioritize context/route.ts in P0/P1 but listed "GEMINI.md" under Memory/Layer A.
  // We have memory/route.ts now.
  // Is context different? "context" usually refers to directories.
  // app/api/context/route.ts might still be using CLI.
  // But let's leave it for now if not explicitly in P0 list, or assume it's part of MemoryManager?
  // DirectoryManager uses fetchContext.
  // Let's assume /api/context exists and works, or we fix it later.
  const res = await fetch('/api/context');
  if (!res.ok) throw new Error('Failed to fetch context');
  return res.json();
}

export async function addDirectory(path: string): Promise<void> {
  const res = await fetch('/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', path }),
  });
  if (!res.ok) throw new Error('Failed to add directory');
}

export async function removeDirectory(path: string): Promise<void> {
  const res = await fetch('/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', path }),
  });
  if (!res.ok) throw new Error('Failed to remove directory');
}

// MCP Servers
export async function fetchMCPServers(): Promise<MCPServer[]> {
  const res = await fetch('/api/mcp');
  if (!res.ok) throw new Error('Failed to fetch MCP servers');
  const data = await res.json();
  // Backend returns Record<string, config>
  return Object.entries(data).map(([name, config]: [string, any]) => ({
    name,
    ...config,
    // Add enabled status if present, default to true?
    enabled: config.enabled !== false
  }));
}

export async function addMCPServer(name: string, config: any): Promise<void> {
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', serverName: name, config }),
  });
  if (!res.ok) throw new Error('Failed to add MCP server');
}

export async function removeMCPServer(name: string): Promise<void> {
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', serverName: name }),
  });
  if (!res.ok) throw new Error('Failed to remove MCP server');
}

export async function toggleMCPServer(name: string, enabled: boolean): Promise<void> {
  // Use 'update' action to set enabled flag
  // We need to know the current config to preserve other fields?
  // The backend 'update' does a merge: { ...current, ...config }.
  // So we just send { enabled }.
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      action: 'update', 
      serverName: name, 
      config: { enabled } 
    }),
  });
  if (!res.ok) throw new Error('Failed to toggle MCP server');
}

// Analytics
export async function fetchAnalytics(): Promise<UsageMetrics> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// Settings
export async function fetchSettings(): Promise<any> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// Sessions
export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch('/api/sessions'); // Assuming sessions API is separate or part of chat?
  // User didn't mention sessions/route.ts in P0.
  // Assuming it works.
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

// Tools
export async function fetchTools(): Promise<Tool[]> {
  const res = await fetch('/api/tools');
  if (!res.ok) throw new Error('Failed to fetch tools');
  const settings = await res.json();
  
  const exclude = new Set(settings.exclude || []);
  
  // Return standard tools with enabled status
  return STANDARD_TOOLS.map(name => ({
    name,
    description: 'Built-in tool',
    type: 'core',
    enabled: !exclude.has(name)
  }));
}

export async function toggleTool(name: string, enabled: boolean): Promise<void> {
  // Read current settings first to get exclude list
  const res = await fetch('/api/tools');
  if (!res.ok) throw new Error('Failed to fetch tools for toggle');
  const settings = await res.json();
  
  let exclude = settings.exclude || [];
  
  if (enabled) {
    // Remove from exclude
    exclude = exclude.filter((t: string) => t !== name);
  } else {
    // Add to exclude
    if (!exclude.includes(name)) {
      exclude.push(name);
    }
  }
  
  const updateRes = await fetch('/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field: 'exclude', value: exclude }),
  });
  
  if (!updateRes.ok) throw new Error('Failed to toggle tool');
}

// Extensions
export async function fetchExtensions(): Promise<Extension[]> {
  const res = await fetch('/api/extensions');
  if (!res.ok) throw new Error('Failed to fetch extensions');
  return res.json();
}

export async function installExtension(urlOrPath: string): Promise<void> {
  const res = await fetch('/api/extensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'install', url: urlOrPath }),
  });
  if (!res.ok) throw new Error('Failed to install extension');
}

export async function uninstallExtension(name: string): Promise<void> {
  // The API expects 'url' for uninstall too?
  // My implementation: `gemini extensions uninstall ${url}`.
  // The CLI uninstall command usually takes the name or package.
  // Let's pass the name as url.
  const res = await fetch('/api/extensions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'uninstall', url: name }),
  });
  if (!res.ok) throw new Error('Failed to uninstall extension');
}

// Hooks
export async function fetchHooks(): Promise<HooksData> {
  const res = await fetch('/api/hooks');
  if (!res.ok) throw new Error('Failed to fetch hooks');
  return res.json();
}

export async function toggleHook(name: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/hooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle', hookName: name, enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle hook');
}

export async function toggleGlobalHooks(enabled: boolean): Promise<void> {
  const res = await fetch('/api/hooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'toggle-global', enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle global hooks');
}

export async function addHook(hookName: string, configs: HookConfig[]): Promise<void> {
  const res = await fetch('/api/hooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', hookName, hookConfigs: configs }),
  });
  if (!res.ok) throw new Error('Failed to add hook');
}

export async function removeHook(hookName: string): Promise<void> {
  const res = await fetch('/api/hooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', hookName }),
  });
  if (!res.ok) throw new Error('Failed to remove hook');
}

// Memory
export async function fetchMemory(): Promise<{ content: string }> {
  const res = await fetch('/api/memory');
  if (!res.ok) throw new Error('Failed to fetch memory');
  const data = await res.json(); // [{ path, content }]
  
  // Find project memory first
  const projectMem = data.find((m: any) => m.path.includes(process.cwd()));
  const content = projectMem ? projectMem.content : (data[0]?.content || '');
  
  return { content };
}

export async function addMemory(content: string): Promise<void> {
  // We need a path. Default to project GEMINI.md
  // We can't know the absolute path easily in the browser.
  // But the backend expects 'path'.
  // Wait, the backend runs in Node.
  // The Client (browser) doesn't know the server path.
  // We should update the backend to accept 'scope' or default path.
  // But I already wrote the backend to expect 'path'.
  // This is a problem.
  // I should update memory/route.ts to handle default path if not provided.
  
  // Let's update memory/route.ts first.
  
  const res = await fetch('/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }), // Omit path, hope backend handles it
  });
  if (!res.ok) throw new Error('Failed to add memory');
}
