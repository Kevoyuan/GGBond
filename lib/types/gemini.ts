// Type definitions based on gemini-cli-api.md

export interface Checkpoint {
  id: string;
  tag: string; // From /chat save <tag>
  timestamp: string;
  messageCount: number;
  type: 'auto' | 'manual';
  branch?: string;
}

export interface Session {
  id: string;
  title: string;
  lastActive: string;
  updated_at?: number; // From DB
  model: string;
  tokens: number;
}

export interface ProjectContext {
  workingDirectory: string;
  includedDirectories: string[];
  memoryFiles: {
    path: string;
    status: 'active' | 'ignored' | 'pending';
    size?: number;
  }[];
  totalIndexedFiles: number;
  contextSize: string;
}

export interface MCPServer {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolsCount: number;
  resourcesCount: number;
  error?: string;
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  activeThreads: number;
  uptime: string;
}

export interface StatEntry {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  cost: number;
  count: number;
}

export interface UsageMetrics {
  daily: StatEntry;
  weekly: StatEntry;
  monthly: StatEntry;
  total: StatEntry;
  // Legacy fields for backward compatibility if needed, or remove
  // For now, let's keep the new structure clean.
  // totalTokens: number; 
  // inputTokens: number;
  // outputTokens: number;
  // estimatedCost: number;
  // dailyUsage: { date: string; tokens: number }[];
}

export interface Tool {
  name: string;
  description: string;
  enabled: boolean;
  type?: 'native' | 'mcp' | 'core';
}

export interface Extension {
  name: string;
  version: string;
  description?: string;
  status: 'active' | 'inactive';
}

export interface HookConfig {
  command: string;
  timeout?: number;
}

export interface Hook {
  name: string;           // "BeforeTool", "AfterTool", "SessionStart" etc.
  configs: HookConfig[];  // All hook commands for this event
  enabled: boolean;       // Global enable status for this hook type
}

export interface HooksData {
  globalEnabled: boolean;
  notifications: boolean;
  hooks: Hook[];
}
