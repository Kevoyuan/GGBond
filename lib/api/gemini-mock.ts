import { Checkpoint, ProjectContext, UsageMetrics, MCPServer } from '../types/gemini';

// Mock data generator for development
// In production, these would fetch from the CLI API

export const mockCheckpoints: Checkpoint[] = [
  { id: 'cp_init', tag: 'init', timestamp: '2024-02-09T10:00:00Z', messageCount: 0, type: 'auto' },
  { id: 'cp_feat_auth', tag: 'feat/auth-flow', timestamp: '2024-02-09T10:45:00Z', messageCount: 12, type: 'manual' },
  { id: 'cp_fix_bug', tag: 'fix/login-error', timestamp: '2024-02-09T11:20:00Z', messageCount: 18, type: 'manual' },
  { id: 'cp_curr', tag: 'current', timestamp: '2024-02-09T11:35:00Z', messageCount: 24, type: 'auto' },
];

export const mockContext: ProjectContext = {
  workingDirectory: process.cwd(),
  includedDirectories: ['../lib', '../docs'],
  memoryFiles: [
    { path: 'GEMINI.md', status: 'active', size: 1024 },
    { path: 'package.json', status: 'active', size: 2048 },
    { path: '.env.local', status: 'ignored' },
  ],
  totalIndexedFiles: 142,
  contextSize: '1.2MB',
};

export const mockMetrics: UsageMetrics = {
  totalTokens: 842000,
  inputTokens: 620000,
  outputTokens: 222000,
  estimatedCost: 4.20,
  dailyUsage: [
    { date: 'Mon', tokens: 30000 },
    { date: 'Tue', tokens: 45000 },
    { date: 'Wed', tokens: 25000 },
    { date: 'Thu', tokens: 60000 },
    { date: 'Fri', tokens: 85000 },
    { date: 'Sat', tokens: 40000 },
    { date: 'Sun', tokens: 55000 },
  ],
};

export const mockMCPServers: MCPServer[] = [
  { name: 'filesystem', status: 'connected', toolsCount: 4, resourcesCount: 0 },
  { name: 'github', status: 'connected', toolsCount: 12, resourcesCount: 5 },
  { name: 'postgres', status: 'error', toolsCount: 0, resourcesCount: 0, error: 'Connection refused' },
];
