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

export interface UsageMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  dailyUsage: { date: string; tokens: number }[];
}
