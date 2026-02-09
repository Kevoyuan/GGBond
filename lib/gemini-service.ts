/**
 * Unified Gemini CLI Service Layer
 * Provides real data from: ~/.gemini/settings.json, CLI process, filesystem, telemetry logs
 */
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
    core?: string[];
    exclude?: string[];
    allowed?: string[];
    shell?: {
        enableInteractiveShell?: boolean;
        showColor?: boolean;
        inactivityTimeout?: number;
    };
}

// Built-in tools list per gemini-cli-api.md
export const BUILTIN_TOOLS = [
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

export async function getToolsConfig(): Promise<ToolsConfig> {
    const settings = await readSettings();
    return settings.tools || {};
}

// ─── Hooks Config ────────────────────────────────────────
export const HOOK_EVENTS = [
    'BeforeTool', 'AfterTool', 'BeforeAgent', 'AfterAgent',
    'SessionStart', 'SessionEnd', 'BeforeModel', 'AfterModel',
    'PreCompress', 'BeforeToolSelection', 'Notification',
] as const;

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
export const KNOWN_MODELS = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'pro', contextWindow: '2M' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'flash', contextWindow: '1M' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', tier: 'lite', contextWindow: '1M' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', tier: 'pro', contextWindow: '1M' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', tier: 'flash', contextWindow: '1M' },
];

export async function getModelConfig(): Promise<{
    current: string;
    customAliases: Record<string, any>;
    known: typeof KNOWN_MODELS;
}> {
    const settings = await readSettings();
    return {
        current: settings.model?.name || process.env.GEMINI_MODEL || 'gemini-2.5-pro',
        customAliases: settings.modelConfigs?.customAliases || {},
        known: KNOWN_MODELS,
    };
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
