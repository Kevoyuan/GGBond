/**
 * Configuration Service
 * Manages .geminiignore, Trusted Folders, and Custom Commands
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import db from '@/lib/db';

// Types
export interface GeminiIgnoreConfig {
    patterns: string[];
    enabled: boolean;
}

export interface TrustedFolder {
    id: string;
    path: string;
    description?: string;
    addedAt: number;
}

export interface CustomCommand {
    id: string;
    name: string;
    description: string;
    command: string;
    enabled: boolean;
    createdAt: number;
}

export interface AppConfig {
    geminiIgnore: GeminiIgnoreConfig;
    trustedFolders: TrustedFolder[];
    customCommands: CustomCommand[];
    mcpSecurity: McpSecurityConfig;
}

export interface McpSecurityConfig {
    enabled: boolean;
    allowedServerNames: string[];
    allowedCommandRegex: string[];
    blockedCommandRegex: string[];
    allowedRepoPatterns: string[];
}

// ─── Database Operations ─────────────────────────────────

function getConfigRow(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
}

function setConfigRow(key: string, value: string): void {
    db.prepare(`
        INSERT INTO app_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, Date.now());
}

// ─── GeminiIgnore ────────────────────────────────────────

export async function getGeminiIgnoreConfig(): Promise<GeminiIgnoreConfig> {
    const stored = getConfigRow('geminiignore');
    if (stored) {
        return JSON.parse(stored);
    }
    return { patterns: [], enabled: true };
}

export async function saveGeminiIgnoreConfig(config: GeminiIgnoreConfig): Promise<void> {
    setConfigRow('geminiignore', JSON.stringify(config));
}

/**
 * Check if a file path should be ignored based on .geminiignore patterns
 * @param filePath - The absolute file path to check
 * @param cwd - Current working directory (project root)
 * @returns true if the file should be ignored
 */
export async function isIgnoredByGeminiIgnore(filePath: string, cwd: string): Promise<boolean> {
    const config = await getGeminiIgnoreConfig();
    if (!config.enabled || config.patterns.length === 0) {
        return false;
    }

    const normalizedPath = path.normalize(filePath);
    const relativePath = path.relative(cwd, normalizedPath);

    for (const pattern of config.patterns) {
        if (matchIgnorePattern(relativePath, normalizedPath, pattern, cwd)) {
            return true;
        }
    }

    return false;
}

/**
 * Match a file path against an ignore pattern
 * Supports: *, **, ?, exact matches, and directory patterns (ending with /)
 */
function matchIgnorePattern(relativePath: string, absolutePath: string, pattern: string, cwd: string): boolean {
    // Handle directory patterns (ending with /)
    if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (relativePath.startsWith(dirPattern) || absolutePath.includes(`/${dirPattern}/`)) {
            return true;
        }
    }

    // Handle ** (match any number of directories)
    if (pattern.includes('**')) {
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(relativePath) || regex.test(absolutePath)) {
            return true;
        }
    }

    // Handle * (match any characters except /)
    if (pattern.includes('*')) {
        const regexPattern = pattern
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(relativePath) || regex.test(absolutePath)) {
            return true;
        }
    }

    // Exact match
    if (relativePath === pattern || absolutePath === pattern || absolutePath.endsWith('/' + pattern)) {
        return true;
    }

    return false;
}

/**
 * Parse .geminiignore file from project directory
 * @param projectPath - Path to the project directory
 * @returns Array of ignore patterns
 */
export async function parseGeminiIgnoreFile(projectPath: string): Promise<string[]> {
    const ignoreFilePath = path.join(projectPath, '.geminiignore');

    try {
        const content = await fsp.readFile(ignoreFilePath, 'utf-8');
        const patterns: string[] = [];

        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            // Skip empty lines and comments
            if (trimmed && !trimmed.startsWith('#')) {
                patterns.push(trimmed);
            }
        }

        return patterns;
    } catch {
        return [];
    }
}

// ─── Trusted Folders ─────────────────────────────────────

export async function getTrustedFolders(): Promise<TrustedFolder[]> {
    const stored = getConfigRow('trusted_folders');
    if (stored) {
        return JSON.parse(stored);
    }
    return [];
}

export async function saveTrustedFolders(folders: TrustedFolder[]): Promise<void> {
    setConfigRow('trusted_folders', JSON.stringify(folders));
}

export async function addTrustedFolder(folder: Omit<TrustedFolder, 'id' | 'addedAt'>): Promise<TrustedFolder> {
    const folders = await getTrustedFolders();
    const newFolder: TrustedFolder = {
        ...folder,
        id: `folder-${Date.now()}`,
        addedAt: Date.now(),
    };
    folders.push(newFolder);
    await saveTrustedFolders(folders);
    return newFolder;
}

export async function removeTrustedFolder(id: string): Promise<void> {
    const folders = await getTrustedFolders();
    const filtered = folders.filter(f => f.id !== id);
    await saveTrustedFolders(filtered);
}

/**
 * Check if a file path is within a trusted folder
 * @param filePath - The absolute file path to check
 * @returns true if the path is in a trusted folder
 */
export async function isPathTrusted(filePath: string): Promise<boolean> {
    const folders = await getTrustedFolders();
    if (folders.length === 0) {
        return false;
    }

    const normalizedPath = path.normalize(filePath);

    for (const folder of folders) {
        const normalizedFolder = path.normalize(folder.path);
        if (normalizedPath.startsWith(normalizedFolder + path.sep) || normalizedPath === normalizedFolder) {
            return true;
        }
    }

    return false;
}

// ─── Custom Commands ─────────────────────────────────────

export async function getCustomCommands(): Promise<CustomCommand[]> {
    const stored = getConfigRow('custom_commands');
    if (stored) {
        return JSON.parse(stored);
    }
    return [];
}

// ─── MCP Security (Allowlist / Blocklist) ───────────────

const DEFAULT_MCP_SECURITY_CONFIG: McpSecurityConfig = {
    enabled: false,
    allowedServerNames: [],
    allowedCommandRegex: [],
    blockedCommandRegex: [],
    allowedRepoPatterns: [],
};

export async function getMcpSecurityConfig(): Promise<McpSecurityConfig> {
    const stored = getConfigRow('mcp_security');
    if (!stored) return DEFAULT_MCP_SECURITY_CONFIG;
    try {
        const parsed = JSON.parse(stored) as Partial<McpSecurityConfig>;
        return {
            enabled: parsed.enabled ?? DEFAULT_MCP_SECURITY_CONFIG.enabled,
            allowedServerNames: Array.isArray(parsed.allowedServerNames) ? parsed.allowedServerNames : [],
            allowedCommandRegex: Array.isArray(parsed.allowedCommandRegex) ? parsed.allowedCommandRegex : [],
            blockedCommandRegex: Array.isArray(parsed.blockedCommandRegex) ? parsed.blockedCommandRegex : [],
            allowedRepoPatterns: Array.isArray(parsed.allowedRepoPatterns) ? parsed.allowedRepoPatterns : [],
        };
    } catch {
        return DEFAULT_MCP_SECURITY_CONFIG;
    }
}

export async function saveMcpSecurityConfig(config: McpSecurityConfig): Promise<void> {
    setConfigRow('mcp_security', JSON.stringify(config));
}

export async function saveCustomCommands(commands: CustomCommand[]): Promise<void> {
    setConfigRow('custom_commands', JSON.stringify(commands));
}

export async function addCustomCommand(command: Omit<CustomCommand, 'id' | 'createdAt'>): Promise<CustomCommand> {
    const commands = await getCustomCommands();
    const newCommand: CustomCommand = {
        ...command,
        id: `cmd-${Date.now()}`,
        createdAt: Date.now(),
    };
    commands.push(newCommand);
    await saveCustomCommands(commands);
    return newCommand;
}

export async function updateCustomCommand(id: string, updates: Partial<CustomCommand>): Promise<CustomCommand | null> {
    const commands = await getCustomCommands();
    const index = commands.findIndex(c => c.id === id);
    if (index === -1) {
        return null;
    }
    commands[index] = { ...commands[index], ...updates };
    await saveCustomCommands(commands);
    return commands[index];
}

export async function removeCustomCommand(id: string): Promise<void> {
    const commands = await getCustomCommands();
    const filtered = commands.filter(c => c.id !== id);
    await saveCustomCommands(filtered);
}

/**
 * Find a custom command by name (without the / prefix)
 */
export async function findCustomCommand(name: string): Promise<CustomCommand | null> {
    const commands = await getCustomCommands();
    return commands.find(c => c.name.toLowerCase() === name.toLowerCase() && c.enabled) || null;
}

// ─── Full Config ────────────────────────────────────────

export async function getFullConfig(): Promise<AppConfig> {
    const [geminiIgnore, trustedFolders, customCommands, mcpSecurity] = await Promise.all([
        getGeminiIgnoreConfig(),
        getTrustedFolders(),
        getCustomCommands(),
        getMcpSecurityConfig(),
    ]);

    return {
        geminiIgnore,
        trustedFolders,
        customCommands,
        mcpSecurity,
    };
}

export async function saveFullConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    if (config.geminiIgnore) {
        await saveGeminiIgnoreConfig(config.geminiIgnore);
    }
    if (config.trustedFolders) {
        await saveTrustedFolders(config.trustedFolders);
    }
    if (config.customCommands) {
        await saveCustomCommands(config.customCommands);
    }
    if (config.mcpSecurity) {
        await saveMcpSecurityConfig(config.mcpSecurity);
    }

    return getFullConfig();
}
