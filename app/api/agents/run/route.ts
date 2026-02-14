import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { CoreService } from '@/lib/core-service';
import { GeminiEventType, ServerGeminiContentEvent } from '@google/gemini-cli-core';

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
};

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

    // Get current model from settings if "inherit"
    let effectiveModel = model;
    if (!model || model === 'inherit') {
      const coreService = CoreService.getInstance();
      effectiveModel = coreService.config?.getModel() || 'gemini-2.5-pro';
    }

    // Insert agent run record
    db.prepare(`
      INSERT INTO agent_runs (id, agent_name, description, task, status, workspace, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)
    `).run(runId, agentName, task.substring(0, 100), task, workspace || null, effectiveModel || null, now, now);

    // Get agent definition
    const coreService = CoreService.getInstance();
    const agentDefinition = coreService.getAgentDefinition(agentName) as AgentDefinitionLike | null | undefined;

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
    executeAgentRun(runId, agentName, agentDefinition.promptConfig?.systemPrompt || '', task, workspace, model).catch(err => {
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
