
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import { Storage } from '@google/gemini-cli-core';
import path from 'path';
import fs from 'fs';

// Built-in agents that are not in user agents directory
const BUILT_IN_AGENTS = ['codebase-investigator', 'cli-help-agent', 'generalist-agent'];

// Read agent definition from a markdown file
function readAgentFromFile(filePath: string): { name: string; displayName?: string; description: string; kind: 'local' | 'remote'; experimental?: boolean; content?: string } | null {
    try {
        const fullContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fullContent.split('\n');

        let inFrontmatter = false;
        const frontmatter: Record<string, string> = {};

        for (const line of lines) {
            if (line.trim() === '---') {
                if (!inFrontmatter) {
                    inFrontmatter = true;
                    continue;
                } else {
                    break;
                }
            }
            if (inFrontmatter && line.includes(':')) {
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                frontmatter[key] = value;
            }
        }

        if (!frontmatter.name) return null;

        // Extract content after frontmatter
        let content = '';
        let dashCount = 0;
        let contentLines = [];
        for (const line of lines) {
            if (line.trim() === '---') {
                dashCount++;
                continue;
            }
            if (dashCount >= 2) {
                contentLines.push(line);
            }
        }
        content = contentLines.join('\n').trim();

        return {
            name: frontmatter.name,
            displayName: frontmatter.displayName || undefined,
            description: frontmatter.description || '',
            kind: (frontmatter.kind as 'local' | 'remote') || 'local',
            experimental: frontmatter.experimental === 'true',
            content: content || undefined,
        };
    } catch {
        return null;
    }
}

// Read all agents from user agents directory
function getUserAgents(): { name: string; displayName?: string; description: string; kind: 'local' | 'remote'; experimental?: boolean; content?: string }[] {
    try {
        const userAgentsDir = Storage.getUserAgentsDir();
        if (!fs.existsSync(userAgentsDir)) {
            return [];
        }

        const files = fs.readdirSync(userAgentsDir);
        const agents: { name: string; displayName?: string; description: string; kind: 'local' | 'remote'; experimental?: boolean }[] = [];

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

export async function GET() {
    try {
        // Get user agents from disk (always fresh)
        const userAgents = getUserAgents();

        // Try to get built-in agents from CoreService
        let builtInAgents: { name: string; displayName?: string; description: string; kind: 'local' | 'remote'; experimental?: boolean; content?: string }[] = [];

        try {
            const core = CoreService.getInstance();
            if (core.config) {
                builtInAgents = core.config.getAgentRegistry().getAllDefinitions() || [];
            }
        } catch (e) {
            console.warn('[agents] Failed to get agents from CoreService, using fallback:', e);
            // Use fallback built-in agents
            builtInAgents = BUILT_IN_AGENTS.map(name => ({
                name,
                description: `Built-in agent: ${name}`,
                kind: 'local' as const,
            }));
        }

        // Combine user agents and built-in agents
        const allAgents = [...userAgents, ...builtInAgents];

        return NextResponse.json({ agents: allAgents });
    } catch (error) {
        console.error('Error fetching agents:', error);
        // Fallback: read directly from disk
        try {
            const userAgents = getUserAgents();
            const agents = [
                ...userAgents,
                ...BUILT_IN_AGENTS.map(name => ({
                    name,
                    description: `Built-in agent: ${name}`,
                    kind: 'local' as const,
                })),
            ];
            return NextResponse.json({ agents });
        } catch (fallbackError) {
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }
}
