/**
 * Unified Gemini CLI Service Layer
 * Provides real data from: ~/.gemini/settings.json, CLI process, filesystem, telemetry logs
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';

// ─── Paths ───────────────────────────────────────────────
export function getGeminiHome(): string {
    return process.env.GEMINI_CLI_HOME || path.join(os.homedir(), '.gemini');
}

export function getSettingsPath(): string {
    return path.join(getGeminiHome(), 'settings.json');
}

export function getProjectSettingsPath(cwd?: string): string {
    return path.join(cwd || process.cwd(), '.gemini', 'settings.json');
}

// ─── Settings Read/Write ─────────────────────────────────
export async function readSettings(): Promise<Record<string, any>> {
    const settingsPath = getSettingsPath();
    try {
        const content = await fsp.readFile(settingsPath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

export async function writeSettings(settings: Record<string, any>): Promise<void> {
    const settingsPath = getSettingsPath();
    await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export async function mergeSettings(partial: Record<string, any>): Promise<Record<string, any>> {
    const current = await readSettings();
    const merged = deepMerge(current, partial);
    await writeSettings(merged);
    return merged;
}

// ─── Auth Info ───────────────────────────────────────────
export interface AuthInfo {
    type: string; // 'oauth-personal' | 'gemini-api-key' | 'vertex-ai'
    accountId?: string;
    accounts?: Array<{ email: string; displayName?: string }>;
    userId?: string;
    hasOAuthCreds: boolean;
    hasApiKey: boolean;
}

export async function getAuthInfo(): Promise<AuthInfo> {
    const geminiHome = getGeminiHome();
    const settings = await readSettings();

    const authType = settings?.security?.auth?.selectedType
        || settings?.selectedAuthType
        || 'unknown';

    let accountId: string | undefined;
    let accounts: Array<{ email: string; displayName?: string }> = [];
    let userId: string | undefined;

    try {
        accountId = (await fsp.readFile(path.join(geminiHome, 'google_account_id'), 'utf-8')).trim();
    } catch { /* ignore */ }

    try {
        const accountsJson = await fsp.readFile(path.join(geminiHome, 'google_accounts.json'), 'utf-8');
        const parsed = JSON.parse(accountsJson);
        if (Array.isArray(parsed)) accounts = parsed;
        else if (parsed && typeof parsed === 'object') accounts = [parsed];
    } catch { /* ignore */ }

    try {
        userId = (await fsp.readFile(path.join(geminiHome, 'user_id'), 'utf-8')).trim();
    } catch { /* ignore */ }

    const hasOAuthCreds = fs.existsSync(path.join(geminiHome, 'oauth_creds.json'));
    const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

    return { type: authType, accountId, accounts, userId, hasOAuthCreds, hasApiKey };
}

// ─── MCP Servers ─────────────────────────────────────────
export interface MCPServerConfig {
    name: string;
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    httpUrl?: string;
    headers?: Record<string, string>;
    timeout?: number;
    trust?: boolean;
    includeTools?: string[];
    excludeTools?: string[];
}

export async function getMCPServers(): Promise<MCPServerConfig[]> {
    const settings = await readSettings();
    const servers = settings.mcpServers || {};
    return Object.entries(servers).map(([name, config]) => ({
        name,
        ...(config as Record<string, any>),
    }));
}

export async function addMCPServer(name: string, config: Omit<MCPServerConfig, 'name'>): Promise<void> {
    const settings = await readSettings();
    if (!settings.mcpServers) settings.mcpServers = {};
    settings.mcpServers[name] = config;
    await writeSettings(settings);
}

export async function removeMCPServer(name: string): Promise<void> {
    const settings = await readSettings();
    if (settings.mcpServers) {
        delete settings.mcpServers[name];
        await writeSettings(settings);
    }
}

// ─── Tools Config ────────────────────────────────────────
export interface ToolsConfig {
    sandbox?: string;
    approvalMode?: string;
    headless?: boolean | string;
    core?: string[];
    exclude?: string[];
    allowed?: string[];
    shell?: {
        enableInteractiveShell?: boolean;
        showColor?: boolean;
        inactivityTimeout?: number;
    };
}

// Built-in tools - dynamically retrieved from CoreService
// Fallback list for when CoreService is not available
const FALLBACK_TOOLS = [
    { name: 'list_directory', displayName: 'ReadFolder', requiresApproval: false },
    { name: 'read_file', displayName: 'ReadFile', requiresApproval: false },
    { name: 'write_file', displayName: 'WriteFile', requiresApproval: true },
    { name: 'glob', displayName: 'FindFiles', requiresApproval: false },
    { name: 'grep_search', displayName: 'SearchText', requiresApproval: false },
    { name: 'replace', displayName: 'Edit', requiresApproval: true },
    { name: 'run_shell_command', displayName: 'Shell', requiresApproval: true },
    { name: 'google_web_search', displayName: 'GoogleSearch', requiresApproval: false },
    { name: 'web_fetch', displayName: 'WebFetch', requiresApproval: false },
    { name: 'save_memory', displayName: 'SaveMemory', requiresApproval: false },
    { name: 'write_todos', displayName: 'WriteTodos', requiresApproval: false },
];

export async function getBuiltinTools(): Promise<typeof FALLBACK_TOOLS> {
    try {
        const { CoreService } = await import('@/lib/core-service');
        const core = CoreService.getInstance();
        if (core.config) {
            const registry = core.config.getToolRegistry() as unknown as Record<string, unknown>;
            // Try various methods to get tools from the registry
            const getAllDefs = registry.getAllDefinitions as ((...args: unknown[]) => unknown) | undefined;
            const tools = getAllDefs?.() || (registry.tools as unknown[]) || [];
            if (Array.isArray(tools) && tools.length > 0) {
                return tools.map((tool: { name: string; description?: string }) => ({
                    name: tool.name,
                    displayName: tool.description || tool.name,
                    requiresApproval: false,
                }));
            }
        }
    } catch (error) {
        console.warn('[gemini-service] Failed to get tools from CoreService, using fallback:', error);
    }
    return FALLBACK_TOOLS;
}

export async function getToolsConfig(): Promise<ToolsConfig> {
    const settings = await readSettings();
    return settings.tools || {};
}

export async function updateToolsConfig(updates: Partial<ToolsConfig>): Promise<ToolsConfig> {
    const settings = await readSettings();
    const currentTools = settings.tools || {};
    const updatedTools = { ...currentTools, ...updates };
    settings.tools = updatedTools;
    await writeSettings(settings);

    // Also check for headless env var as fallback
    if (process.env.GEMINI_HEADLESS === '1' || process.env.GEMINI_HEADLESS === 'true') {
        settings.tools.headless = true;
    }

    return updatedTools;
}

// ─── Hooks Config ────────────────────────────────────────
// Hook events - dynamically retrieved from settings if available
const FALLBACK_HOOK_EVENTS = [
    'BeforeTool', 'AfterTool', 'BeforeAgent', 'AfterAgent',
    'SessionStart', 'SessionEnd', 'BeforeModel', 'AfterModel',
    'PreCompress', 'BeforeToolSelection', 'Notification',
] as const;

export async function getHookEvents(): Promise<readonly string[]> {
    const settings = await readSettings();
    // Check if custom hook events are configured in settings
    const customEvents = settings.hooksConfig?.availableEvents || [];
    if (customEvents.length > 0) {
        return customEvents as readonly string[];
    }
    return FALLBACK_HOOK_EVENTS;
}

export interface HooksConfig {
    hooksConfig: {
        enabled: boolean;
        disabled: string[];
        notifications: boolean;
    };
    hooks: Record<string, any[]>;
}

export async function getHooksConfig(): Promise<HooksConfig> {
    const settings = await readSettings();
    return {
        hooksConfig: settings.hooksConfig || { enabled: true, disabled: [], notifications: true },
        hooks: settings.hooks || {},
    };
}

// ─── GEMINI.md / Memory ──────────────────────────────────
export interface GeminiMdFile {
    path: string;
    scope: 'global' | 'project';
    content: string;
    size: number;
}

export async function findGeminiMdFiles(cwd?: string): Promise<GeminiMdFile[]> {
    const results: GeminiMdFile[] = [];

    // Global
    const globalPath = path.join(getGeminiHome(), 'GEMINI.md');
    try {
        const content = await fsp.readFile(globalPath, 'utf-8');
        results.push({ path: globalPath, scope: 'global', content, size: Buffer.byteLength(content) });
    } catch { /* ignore */ }

    // Project-level
    const projectDir = cwd || process.cwd();
    const projectPath = path.join(projectDir, 'GEMINI.md');
    try {
        const content = await fsp.readFile(projectPath, 'utf-8');
        results.push({ path: projectPath, scope: 'project', content, size: Buffer.byteLength(content) });
    } catch { /* ignore */ }

    // Also check .gemini/GEMINI.md in project
    const dotGeminiPath = path.join(projectDir, '.gemini', 'GEMINI.md');
    try {
        const content = await fsp.readFile(dotGeminiPath, 'utf-8');
        results.push({ path: dotGeminiPath, scope: 'project', content, size: Buffer.byteLength(content) });
    } catch { /* ignore */ }

    return results;
}

// ─── Extensions ──────────────────────────────────────────
export async function listExtensions(): Promise<string> {
    return runGeminiCommand(['extensions', 'list']);
}

// ─── Models ──────────────────────────────────────────────
// Known models - dynamically retrieved from gemini-cli-core if available
// This list is used as fallback when CoreService is not available
const FALLBACK_MODELS = [
    { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', tier: 'pro', contextWindow: '2M' },
    { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', tier: 'flash', contextWindow: '1M' },
    { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', tier: 'lite', contextWindow: '1M' },
    { id: 'gemini-3-pro-preview', name: 'gemini-3-pro-preview', tier: 'pro', contextWindow: '1M' },
    { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview', tier: 'flash', contextWindow: '1M' },
];

// Model metadata including context window and tier (not available from gemini-cli-core)
const MODEL_METADATA: Record<string, { tier: string; contextWindow: string }> = {
    'gemini-2.5-pro': { tier: 'pro', contextWindow: '2M' },
    'gemini-2.5-flash': { tier: 'flash', contextWindow: '1M' },
    'gemini-2.5-flash-lite': { tier: 'lite', contextWindow: '1M' },
    'gemini-3-pro-preview': { tier: 'pro', contextWindow: '1M' },
    'gemini-3-flash-preview': { tier: 'flash', contextWindow: '1M' },
};

export async function getKnownModels() {
    // Try to get valid models from gemini-cli-core
    let validModels: Set<string> | null = null;
    try {
        const { VALID_GEMINI_MODELS } = await import('@google/gemini-cli-core');
        validModels = VALID_GEMINI_MODELS;
    } catch (error) {
        console.warn('[gemini-service] Failed to import VALID_GEMINI_MODELS:', error);
    }

    // Get custom models from settings
    const settings = await readSettings();
    const customModels = settings.modelConfigs?.knownModels || [];

    // Build the model list
    const modelMap = new Map<string, typeof FALLBACK_MODELS[0]>();

    // First add valid models from gemini-cli-core (if available)
    if (validModels) {
        for (const modelId of validModels) {
            const metadata = MODEL_METADATA[modelId] || { tier: 'unknown', contextWindow: '1M' };
            modelMap.set(modelId, {
                id: modelId,
                name: modelId,
                tier: metadata.tier,
                contextWindow: metadata.contextWindow,
            });
        }
    } else {
        // Use fallback if import failed
        for (const model of FALLBACK_MODELS) {
            modelMap.set(model.id, model);
        }
    }

    // Then add custom models (they override built-in)
    for (const model of customModels) {
        if (model.id) {
            modelMap.set(model.id, model);
        }
    }

    return Array.from(modelMap.values());
}

export async function getModelConfig(): Promise<{
    current: string;
    customAliases: Record<string, any>;
    known: typeof FALLBACK_MODELS;
}> {
    const settings = await readSettings();
    const knownModels = await getKnownModels();
    return {
        current: settings.model?.name || process.env.GEMINI_MODEL || 'gemini-2.5-pro',
        customAliases: settings.modelConfigs?.customAliases || {},
        known: knownModels,
    };
}

// ─── Model Presets ────────────────────────────────────────
export interface ModelPreset {
    id: string;
    name: string;
    description?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    // Conditional routing settings
    routing?: {
        enabled: boolean;
        conditions: ModelRoutingCondition[];
    };
}

export interface ModelRoutingCondition {
    type: 'keyword' | 'length' | 'complexity';
    // For keyword type
    keywords?: string[];
    // For length type
    minLength?: number;
    maxLength?: number;
    // For complexity type
    threshold?: number;
    // Target model for this condition
    model: string;
    temperature?: number;
}

// Default presets
const DEFAULT_PRESETS: ModelPreset[] = [
    {
        id: 'balanced',
        name: 'Balanced',
        description: 'Default balanced settings',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
    },
    {
        id: 'creative',
        name: 'Creative',
        description: 'More creative and varied outputs',
        model: 'gemini-2.5-pro',
        temperature: 1.0,
    },
    {
        id: 'precise',
        name: 'Precise',
        description: 'More focused and accurate outputs',
        model: 'gemini-2.5-flash-lite',
        temperature: 0.3,
    },
    {
        id: 'complex',
        name: 'Complex Task',
        description: 'For complex coding tasks',
        model: 'gemini-2.5-pro',
        temperature: 0.9,
        routing: {
            enabled: true,
            conditions: [
                {
                    type: 'keyword',
                    keywords: ['refactor', 'architecture', 'design', 'complex', 'implement'],
                    model: 'gemini-2.5-pro',
                    temperature: 0.9,
                },
                {
                    type: 'length',
                    minLength: 2000,
                    model: 'gemini-2.5-pro',
                    temperature: 0.8,
                },
            ],
        },
    },
    {
        id: 'quick',
        name: 'Quick Query',
        description: 'Fast responses for simple questions',
        model: 'gemini-2.5-flash-lite',
        temperature: 0.5,
        routing: {
            enabled: true,
            conditions: [
                {
                    type: 'length',
                    maxLength: 200,
                    model: 'gemini-2.5-flash-lite',
                    temperature: 0.5,
                },
            ],
        },
    },
];

export async function getModelPresets(): Promise<ModelPreset[]> {
    const settings = await readSettings();
    const customPresets = settings.modelPresets || [];
    return [...DEFAULT_PRESETS, ...customPresets];
}

export async function saveModelPreset(preset: ModelPreset): Promise<void> {
    const settings = await readSettings();
    if (!settings.modelPresets) settings.modelPresets = [];
    const existingIndex = settings.modelPresets.findIndex((p: ModelPreset) => p.id === preset.id);
    if (existingIndex >= 0) {
        settings.modelPresets[existingIndex] = preset;
    } else {
        settings.modelPresets.push(preset);
    }
    await writeSettings(settings);
}

export async function deleteModelPreset(presetId: string): Promise<void> {
    const settings = await readSettings();
    if (settings.modelPresets) {
        settings.modelPresets = settings.modelPresets.filter((p: ModelPreset) => p.id !== presetId);
        await writeSettings(settings);
    }
}

// Get the effective model based on current preset and routing conditions
export function resolveModelForContext(
    preset: ModelPreset | undefined,
    messageLength: number,
    messageContent: string
): { model: string; temperature: number } {
    // If no preset, return defaults
    if (!preset) {
        return { model: 'gemini-2.5-flash', temperature: 0.7 };
    }

    // If routing is not enabled, return preset defaults
    if (!preset.routing?.enabled) {
        return { model: preset.model, temperature: preset.temperature ?? 0.7 };
    }

    // Check routing conditions
    for (const condition of preset.routing.conditions) {
        let match = false;

        if (condition.type === 'keyword' && condition.keywords) {
            const lowerContent = messageContent.toLowerCase();
            match = condition.keywords.some(kw => lowerContent.includes(kw.toLowerCase()));
        } else if (condition.type === 'length') {
            const len = messageLength;
            if (condition.minLength !== undefined && len < condition.minLength) continue;
            if (condition.maxLength !== undefined && len > condition.maxLength) continue;
            match = true;
        }

        if (match) {
            return {
                model: condition.model,
                temperature: condition.temperature ?? preset.temperature ?? 0.7,
            };
        }
    }

    // Default to preset values if no conditions matched
    return { model: preset.model, temperature: preset.temperature ?? 0.7 };
}

// ─── Custom Tools ──────────────────────────────────────────
export interface CustomToolDefinition {
    id: string;
    name: string;
    description: string;
    schema?: Record<string, unknown>;
    handler?: string; // Path to handler function
    enabled: boolean;
}

const DEFAULT_CUSTOM_TOOLS: CustomToolDefinition[] = [];

export async function getCustomTools(): Promise<CustomToolDefinition[]> {
    const settings = await readSettings();
    return settings.customTools || DEFAULT_CUSTOM_TOOLS;
}

export async function saveCustomTool(tool: CustomToolDefinition): Promise<void> {
    const settings = await readSettings();
    if (!settings.customTools) settings.customTools = [];
    const existingIndex = settings.customTools.findIndex((t: CustomToolDefinition) => t.id === tool.id);
    if (existingIndex >= 0) {
        settings.customTools[existingIndex] = tool;
    } else {
        settings.customTools.push(tool);
    }
    await writeSettings(settings);
}

export async function deleteCustomTool(toolId: string): Promise<void> {
    const settings = await readSettings();
    if (settings.customTools) {
        settings.customTools = settings.customTools.filter((t: CustomToolDefinition) => t.id !== toolId);
        await writeSettings(settings);
    }
}

// ─── Telemetry ───────────────────────────────────────────
export interface TelemetryEvent {
    name: string;
    timestamp?: string;
    attributes: Record<string, any>;
}

export async function parseTelemetryLog(maxLines = 500): Promise<TelemetryEvent[]> {
    // Try project-level first, then global
    const paths = [
        path.join(process.cwd(), '.gemini', 'telemetry.log'),
        path.join(process.cwd(), 'gemini-home', '.gemini', 'telemetry.log'),
        path.join(getGeminiHome(), '.gemini', 'telemetry.log'),
        path.join(getGeminiHome(), 'telemetry.log'),
    ];

    for (const logPath of paths) {
        try {
            const content = await fsp.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n').slice(-maxLines);
            const events: TelemetryEvent[] = [];

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    events.push({
                        name: parsed.name || parsed.event || 'unknown',
                        timestamp: parsed.timestamp || parsed.time,
                        attributes: parsed.attributes || parsed,
                    });
                } catch { /* skip malformed lines */ }
            }
            return events;
        } catch { /* try next path */ }
    }
    return [];
}

// ─── Directories ─────────────────────────────────────────
export async function getIncludedDirectories(): Promise<string[]> {
    const settings = await readSettings();
    return settings.context?.includeDirectories || [];
}

export async function setIncludedDirectories(dirs: string[]): Promise<void> {
    const settings = await readSettings();
    if (!settings.context) settings.context = {};
    settings.context.includeDirectories = dirs;
    await writeSettings(settings);
}

// ─── CLI Execution ───────────────────────────────────────
export function runGeminiCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        let geminiPath: string;
        try {
            geminiPath = execSync('which gemini').toString().trim();
            geminiPath = fs.realpathSync(geminiPath);
        } catch {
            reject(new Error('Gemini CLI not found'));
            return;
        }

        const env = { ...process.env, TERM: 'dumb', GEMINI_FORCE_FILE_STORAGE: 'true' };
        const child = spawn(process.execPath, [geminiPath, ...args], { env });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `Command exited with code ${code}`));
            } else {
                resolve(stdout);
            }
        });

        child.on('error', reject);
    });
}

// ─── Helpers ─────────────────────────────────────────────
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
            target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
        ) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}
