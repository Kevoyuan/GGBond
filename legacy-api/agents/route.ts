
import { NextResponse } from '@/src-sidecar/mock-next-server';
import { CoreService } from '@/lib/core-service';
import { Storage } from '@google/gemini-cli-core';
import path from 'path';
import fs from 'fs';
import { load } from 'js-yaml';

// Fallback built-in agents when CoreService is not available
const FALLBACK_BUILT_IN_AGENTS = ['codebase-investigator', 'cli-help-agent', 'generalist-agent'];

// Cache + in-flight dedup for agents list
const AGENTS_CACHE_TTL_MS = 10_000;
let agentsCache: { data: unknown; expiresAt: number } | null = null;
let agentsInFlight: Promise<NextResponse> | null = null;

function getCoreAgentDefinitions(): AgentDefinitionLike[] {
    try {
        const core = CoreService.getInstance();
        const registry = core.config?.getAgentRegistry?.() as
            | { getAllDefinitions?: () => unknown[] }
            | undefined;
        const definitions = registry?.getAllDefinitions?.();
        return Array.isArray(definitions) ? (definitions as AgentDefinitionLike[]) : [];
    } catch (error) {
        console.warn('[agents] Failed to read agent definitions from CoreService:', error);
        return [];
    }
}

type AgentAuthConfig =
    | {
        type: 'apiKey';
        key?: string;
        name?: string;
        agent_card_requires_auth?: boolean;
    }
    | {
        type: 'http';
        scheme?: string;
        token?: string;
        username?: string;
        password?: string;
        value?: string;
        agent_card_requires_auth?: boolean;
    };

type AgentAuthSummary = {
    configured: boolean;
    type: string;
    scheme?: string;
    requiresAgentCardAuth?: boolean;
};

type AgentDefinitionLike = {
    name: string;
    displayName?: string;
    description?: string;
    kind?: 'local' | 'remote' | string;
    experimental?: boolean;
    promptConfig?: {
        systemPrompt?: string;
    };
    modelConfig?: {
        model?: string;
    };
    content?: string;
    agentCardUrl?: string;
    auth?: AgentAuthConfig;
    authSummary?: AgentAuthSummary;
};

const summarizeAuth = (auth?: AgentAuthConfig): AgentAuthSummary | undefined => {
    if (!auth) return undefined;

    return {
        configured: true,
        type: auth.type,
        scheme: auth.type === 'http' ? auth.scheme : undefined,
        requiresAgentCardAuth: Boolean(auth.agent_card_requires_auth),
    };
};

// Dynamically get built-in agents from CoreService or fallback
async function getBuiltInAgents(): Promise<string[]> {
    try {
        const agents = getCoreAgentDefinitions();
        // Filter for built-in agents (typically marked as local kind)
        const builtIn = agents
            .filter((agent: { kind?: string }) => agent.kind === 'builtin' || agent.kind === 'local')
            .map((agent: { name: string }) => agent.name);
        if (builtIn.length > 0) {
            return builtIn;
        }
    } catch (error) {
        console.warn('[agents] Failed to get built-in agents from CoreService:', error);
    }
    return FALLBACK_BUILT_IN_AGENTS;
}

// Read agent definition from a markdown file
function readAgentFromFile(filePath: string): AgentDefinitionLike | null {
    try {
        const fullContent = fs.readFileSync(filePath, 'utf-8');
        const frontmatterMatch = fullContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (!frontmatterMatch) return null;

        const parsed = load(frontmatterMatch[1]);
        const frontmatter = Array.isArray(parsed) ? parsed[0] : parsed;
        if (!frontmatter || typeof frontmatter !== 'object') return null;

        const data = frontmatter as Record<string, unknown>;
        const name = typeof data.name === 'string' ? data.name : '';
        if (!name) return null;

        const kind = data.kind === 'remote' ? 'remote' : 'local';
        const auth = (kind === 'remote' && data.auth && typeof data.auth === 'object')
            ? data.auth as AgentAuthConfig
            : undefined;
        const content = frontmatterMatch[2]?.trim() || undefined;

        return {
            name,
            displayName: typeof data.display_name === 'string'
                ? data.display_name
                : (typeof data.displayName === 'string' ? data.displayName : undefined),
            description: typeof data.description === 'string' ? data.description : '',
            kind,
            experimental: data.experimental === true || data.experimental === 'true',
            content,
            agentCardUrl: typeof data.agent_card_url === 'string' ? data.agent_card_url : undefined,
            auth,
            authSummary: summarizeAuth(auth),
        };
    } catch {
        return null;
    }
}

// Read all agents from user agents directory
function getUserAgents(): AgentDefinitionLike[] {
    try {
        const userAgentsDir = Storage.getUserAgentsDir();
        if (!fs.existsSync(userAgentsDir)) {
            return [];
        }

        const files = fs.readdirSync(userAgentsDir);
        const agents: AgentDefinitionLike[] = [];

        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            // Skip symlinks that point to external directories (imported agents)
            const filePath = path.join(userAgentsDir, file);
            try {
                const stats = fs.lstatSync(filePath);
                if (stats.isSymbolicLink()) {
                    const target = fs.readlinkSync(filePath);
                    // If the symlink points outside the user agents dir, it's an imported agent
                    if (!target.startsWith(userAgentsDir)) {
                        // Still read it - it's a valid agent
                    }
                }
            } catch {
                continue;
            }

            const agent = readAgentFromFile(filePath);
            if (agent) {
                agents.push(agent);
            }
        }

        return agents;
    } catch (error) {
        console.error('Error reading user agents:', error);
        return [];
    }
}

async function fetchAgentsUncached() {
    try {
        // 1. Get user agents from disk (always fresh)
        const userAgents = getUserAgents();
        const agentsMap = new Map<string, AgentDefinitionLike>();

        // Add user agents to map
        userAgents.forEach(agent => agentsMap.set(agent.name, agent));

        // 2. Try to get agents from CoreService
        try {
            const coreAgents = getCoreAgentDefinitions();
            // Only extract plain data fields to avoid circular references
            // (AgentDefinition objects hold refs back into Config/ToolRegistry)
            coreAgents.forEach((agent: AgentDefinitionLike) => agentsMap.set(agent.name, {
                name: agent.name,
                displayName: agent.displayName,
                description: agent.description,
                kind: agent.kind,
                content: agent.content,
                agentCardUrl: agent.agentCardUrl,
                auth: agent.auth,
                authSummary: agent.authSummary ?? summarizeAuth(agent.auth),
                promptConfig: agent.promptConfig ? { systemPrompt: agent.promptConfig.systemPrompt } : undefined,
                modelConfig: agent.modelConfig ? { model: agent.modelConfig.model } : undefined,
            }));
        } catch (e) {
            console.warn('[agents] Failed to get agents from CoreService:', e);
        }

        // 3. Ensure built-in agents are present
        // If they were not in userAgents OR CoreService, add the fallback definition
        const builtInAgents = await getBuiltInAgents();
        builtInAgents.forEach(name => {
            if (!agentsMap.has(name)) {
                agentsMap.set(name, {
                    name,
                    description: `Built-in agent: ${name}`,
                    kind: 'local' as const,
                });
            }
        });

        return { agents: Array.from(agentsMap.values()) };
    } catch (error) {
        console.error('Error fetching agents:', error);
        // Fallback: read directly from disk and add built-ins
        try {
            const userAgents = getUserAgents();
            const agentsMap = new Map<string, AgentDefinitionLike>();
            userAgents.forEach(agent => agentsMap.set(agent.name, agent));

            const builtInAgents = await getBuiltInAgents();
            builtInAgents.forEach(name => {
                if (!agentsMap.has(name)) {
                    agentsMap.set(name, {
                        name,
                        description: `Built-in agent: ${name}`,
                        kind: 'local' as const,
                    });
                }
            });

            return { agents: Array.from(agentsMap.values()) };
        } catch (fallbackError) {
            throw fallbackError;
        }
    }
}

export async function GET() {
    const now = Date.now();
    if (agentsCache && agentsCache.expiresAt > now) {
        return NextResponse.json(agentsCache.data);
    }
    if (agentsInFlight) return agentsInFlight;

    agentsInFlight = (async () => {
        try {
            const data = await fetchAgentsUncached();
            agentsCache = { data, expiresAt: Date.now() + AGENTS_CACHE_TTL_MS };
            return NextResponse.json(data);
        } catch {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        } finally {
            agentsInFlight = null;
        }
    })();
    return agentsInFlight;
}
