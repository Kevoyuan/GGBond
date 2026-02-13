import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { CoreService } from '@/lib/core-service';
import { Config } from '@google/gemini-cli-core';
import path from 'path';

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

    // Insert agent run record
    db.prepare(`
      INSERT INTO agent_runs (id, agent_name, description, task, status, workspace, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)
    `).run(runId, agentName, task.substring(0, 100), task, workspace || null, model || null, now, now);

    // Get agent definition
    const coreService = CoreService.getInstance();
    const agentDefinition = coreService.getAgentDefinition(agentName);

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
    executeAgentRun(runId, agentName, agentDefinition.systemPrompt || '', task, workspace, model).catch(err => {
      console.error('[agent-run] Execution error:', err);
      db.prepare(`
        UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
      `).run(err.message, Date.now(), runId);
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
  const now = Date.now();

  try {
    // Create a new config for this agent run
    const sessionId = `agent-run-${runId}`;
    const cwd = workspace || process.cwd();

    const config = new Config({
      sessionId,
      model: model || 'gemini-2.5-pro',
      targetDir: cwd,
      cwd,
      debugMode: false,
      output: { format: 'STREAM_JSON', verbose: false },
    });

    await config.initialize();

    // Set agent system prompt
    if (systemPrompt) {
      config.getGeminiClient()?.setSystemPrompt(systemPrompt);
    }

    // Create GeminiChat for this run
    const { GeminiChat } = await import('@google/gemini-cli-core');
    const chat = new GeminiChat(config, sessionId);

    // Execute the task
    const turn = chat.createTurn();
    const stream = turn.execute(task);

    let fullResponse = '';

    for await (const event of stream) {
      if (event.type === 'chunk' && event.value) {
        const content = typeof event.value === 'string' ? event.value : JSON.stringify(event.value);
        fullResponse += content;

        // Update progress
        db.prepare(`
          UPDATE agent_runs SET current_content = ?, updated_at = ? WHERE id = ?
        `).run(fullResponse.substring(0, 10000), Date.now(), runId);
      }
    }

    // Mark as completed
    db.prepare(`
      UPDATE agent_runs SET status = 'completed', result = ?, updated_at = ?, completed_at = ? WHERE id = ?
    `).run(fullResponse.substring(0, 50000), Date.now(), Date.now(), runId);

  } catch (error: any) {
    db.prepare(`
      UPDATE agent_runs SET status = 'failed', error = ?, updated_at = ?, completed_at = ? WHERE id = ?
    `).run(error.message, Date.now(), Date.now(), runId);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get('id');

  if (runId) {
    // Get single run
    const run = db.prepare(`
      SELECT * FROM agent_runs WHERE id = ?
    `).get(runId) as any;

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
