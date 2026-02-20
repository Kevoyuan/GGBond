import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { CoreService } from '@/lib/core-service';
import { GeminiEventType, ServerGeminiContentEvent, Storage, isActiveModel } from '@google/gemini-cli-core';
import path from 'path';
import fs from 'fs';

/**
 * Minimal type definition for agent definition from AgentRegistry
 * Matches the structure used in the gemini-cli-core AgentDefinition
 */
type AgentDefinitionLike = {
  name: string;
  displayName?: string;
  description?: string;
  kind?: 'local' | 'remote' | string;
  promptConfig?: {
    systemPrompt?: string;
  };
  modelConfig?: {
    model?: string;
  };
  content?: string;
};

// Fallback for built-in agents
function getBuiltInAgentDefinition(name: string): AgentDefinitionLike | null {
  if (name === 'cli-help-agent') {
    return {
      name: 'cli-help-agent',
      displayName: 'CLI Help Agent',
      description: 'Specialized in answering questions about how users use you, (Gemini CLI): features, documentation, and current runtime configuration.',
      kind: 'local',
      promptConfig: {
        systemPrompt: `You are the Gemini CLI Help Agent. Your purpose is to assist users with understanding and using the Gemini CLI.
You have access to the \`cli_help\` tool which provides detailed information about CLI commands and features.
Always use the \`cli_help\` tool to find accurate information before answering questions about commands, configuration, or features.
Provide clear, concise, and helpful answers based on the documentation provided by the tool.`,
      },
    };
  }

  if (name === 'codebase-investigator') {
    return {
      name: 'codebase-investigator',
      displayName: 'Codebase Investigator',
      description: 'Investigates the codebase to answer questions about architecture, dependencies, and implementation details.',
      kind: 'local',
      promptConfig: {
        systemPrompt: `You are an expert codebase investigator. You have access to the \`codebase_investigator\` tool to analyze the project structure and code.
Use the \`codebase_investigator\` tool to explore the file system, read files, and understand the project's architecture and dependencies.
When asked about the codebase, always start by investigating using the available tools before providing an answer.
Focus on providing accurate and actionable insights based on the actual code.`,
      },
    };
  }

  if (name === 'generalist-agent') {
    return {
      name: 'generalist-agent',
      displayName: 'Generalist Agent',
      description: 'A helpful general-purpose AI assistant.',
      kind: 'local',
      promptConfig: {
        systemPrompt: `You are a helpful general-purpose AI assistant.
You can help with a wide range of tasks including coding, writing, analysis, and more.
Use your knowledge and available tools to assist the user to the best of your ability.`,
      },
    };
  }

  return null;
}

// Read agent definition from a markdown file in user agents directory
function getUserAgentDefinition(name: string): AgentDefinitionLike | null {
  try {
    const userAgentsDir = Storage.getUserAgentsDir();
    if (!fs.existsSync(userAgentsDir)) {
      return null;
    }

    // Try both .md extension and without
    const filePath = path.join(userAgentsDir, `${name}.md`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fullContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fullContent.split('\n');

    // Parse frontmatter
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
    const contentLines: string[] = [];
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
      promptConfig: {
        systemPrompt: content || undefined,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Database row type for agent_runs table
 */
type AgentRunRow = {
  id: string;
  agent_name: string;
  agent_display_name: string | null;
  description: string | null;
  task: string;
  status: string;
  workspace: string | null;
  model: string | null;
  result: string | null;
  error: string | null;
  current_content: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentName, task, workspace, model } = body;

    if (!agentName || !task) {
      return NextResponse.json(
        { error: 'agentName and task are required' },
        { status: 400 }
      );
    }

    const runId = uuidv4();
    const now = Date.now();

    // Resolve model with active-model validation (aligned with core v0.29.5 semantics).
    let effectiveModel = typeof model === 'string' ? model.trim() : '';
    if (!effectiveModel || effectiveModel === 'inherit') {
      const coreService = CoreService.getInstance();
      effectiveModel = coreService.config?.getModel() || 'gemini-2.5-pro';
    }
    if (!isActiveModel(effectiveModel)) {
      effectiveModel = 'gemini-2.5-pro';
    }

    // Insert agent run record
    db.prepare(`
      INSERT INTO agent_runs (id, agent_name, description, task, status, workspace, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)
    `).run(runId, agentName, task.substring(0, 100), task, workspace || null, effectiveModel || null, now, now);

    // Get agent definition - first check user agents on disk, then fall back to AgentRegistry
    let agentDefinition: AgentDefinitionLike | null = getUserAgentDefinition(agentName);

    if (!agentDefinition) {
      const coreService = CoreService.getInstance();
      agentDefinition = coreService.getAgentDefinition(agentName) as AgentDefinitionLike | null ?? null;
    }

    // Fallback for built-in agents if not found in registry
    if (!agentDefinition) {
      agentDefinition = getBuiltInAgentDefinition(agentName);
    }

    if (!agentDefinition) {
      db.prepare(`
        UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
      `).run('Agent not found', now, runId);

      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Start execution in background (async, don't wait)
    executeAgentRun(runId, agentName, agentDefinition.promptConfig?.systemPrompt || '', task, workspace, effectiveModel).catch(err => {
      console.error('[agent-run] Execution error:', err);
      db.prepare(`
        UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
      `).run(err instanceof Error ? err.message : String(err), Date.now(), runId);
    });

    return NextResponse.json({
      id: runId,
      status: 'running',
      agentName,
      task: task.substring(0, 100)
    });
  } catch (error) {
    console.error('[agent-run] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function executeAgentRun(
  runId: string,
  agentName: string,
  systemPrompt: string,
  task: string,
  workspace?: string,
  model?: string
) {
  try {
    // Use CoreService singleton to run the task
    const coreService = CoreService.getInstance();

    // Set system instruction for this agent
    if (systemPrompt) {
      coreService.setSystemInstruction(systemPrompt);
    }

    // Run the turn and collect response
    let fullResponse = '';
    const abortController = new AbortController();

    for await (const event of coreService.runTurn(task, abortController.signal)) {
      // Collect content from events
      if (event.type === GeminiEventType.Content && 'value' in event) {
        const contentEvent = event as ServerGeminiContentEvent;
        const value = contentEvent.value;
        const content = typeof value === 'string' ? value : JSON.stringify(value);
        fullResponse += content;

        // Update progress (throttled)
        if (fullResponse.length % 500 === 0) {
          db.prepare(`
            UPDATE agent_runs SET current_content = ?, updated_at = ? WHERE id = ?
          `).run(fullResponse.substring(0, 10000), Date.now(), runId);
        }
      }
    }

    // Mark as completed
    db.prepare(`
      UPDATE agent_runs SET status = 'completed', result = ?, updated_at = ?, completed_at = ? WHERE id = ?
    `).run(fullResponse.substring(0, 50000), Date.now(), Date.now(), runId);

  } catch (error) {
    db.prepare(`
      UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ?, completed_at = ? WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), Date.now(), Date.now(), runId);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get('id');

  if (runId) {
    // Get single run
    const run = db.prepare(`
      SELECT * FROM agent_runs WHERE id = ?
    `).get(runId) as AgentRunRow | undefined;

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  }

  // Get all runs
  const runs = db.prepare(`
    SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 50
  `).all();

  return NextResponse.json({ runs });
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const runId = searchParams.get('id');

    if (runId) {
      // Delete single run
      const result = db.prepare(`
        DELETE FROM agent_runs WHERE id = ?
      `).run(runId);

      if (result.changes === 0) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, message: 'Run deleted' });
    } else {
      // Clear all runs (that are not running)
      db.prepare(`
        DELETE FROM agent_runs WHERE status != 'running' AND status != 'pending'
      `).run();

      return NextResponse.json({ success: true, message: 'History cleared' });
    }
  } catch (error) {
    console.error('[agent-run] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
