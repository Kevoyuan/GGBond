/**
 * Headless Chat API Endpoint
 * Provides automated chat without interactive confirmations
 * Automatically approves all safe tool executions
 */

import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import { getGeminiEnv } from '@/lib/gemini-utils';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  ToolConfirmationOutcome,
} from '@google/gemini-cli-core';

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

const buildAgentSystemInstruction = (agent: AgentDefinitionLike) => {
  const parts: string[] = [
    `Active agent: ${agent.displayName || agent.name}`,
  ];

  if (agent.description) {
    parts.push(`Agent description: ${agent.description}`);
  }

  if (agent.kind === 'local' && agent.promptConfig?.systemPrompt) {
    parts.push(`Agent system guidance:\n${agent.promptConfig.systemPrompt}`);
  }

  return parts.join('\n\n');
};

export async function POST(req: Request) {
  try {
    const {
      prompt,
      model,
      systemInstruction,
      sessionId,
      workspace,
      modelSettings,
      parentId,
      selectedAgent,
      images
    } = await req.json();

    // Check if headless mode is enabled
    const isHeadless = process.env.GEMINI_HEADLESS === '1' ||
      process.env.GEMINI_HEADLESS === 'true';

    if (!isHeadless) {
      // If not in headless mode, redirect to regular chat or return error
      console.log('[headless] Warning: Called without headless mode enabled');
    }

    if (!prompt && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'Prompt or images are required' }, { status: 400 });
    }

    // In headless mode, always use 'yolo' (auto-approve) mode
    let targetModel = model || 'gemini-2.5-pro';

    const env = getGeminiEnv();
    if (env.GEMINI_CLI_HOME) {
      process.env.GEMINI_CLI_HOME = env.GEMINI_CLI_HOME;
    }

    const core = CoreService.getInstance();

    const finalSessionId = sessionId || crypto.randomUUID();

    // Force YOLO mode for headless - auto-approve all tool executions
    const coreApprovalMode = 'yolo';
    console.log('[headless] Using approval mode: yolo (auto-approve)');

    await core.initialize({
      sessionId: finalSessionId,
      model: targetModel,
      cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
      approvalMode: coreApprovalMode,
      systemInstruction,
      modelSettings
    });

    let selectedAgentName: string | undefined;
    if (typeof selectedAgent === 'string' && selectedAgent.trim()) {
      selectedAgentName = selectedAgent.trim();
    } else if (
      selectedAgent &&
      typeof selectedAgent === 'object' &&
      typeof (selectedAgent as { name?: unknown }).name === 'string'
    ) {
      selectedAgentName = ((selectedAgent as { name: string }).name || '').trim() || undefined;
    }

    if (selectedAgentName) {
      const agent = core.getAgentDefinition(selectedAgentName) as AgentDefinitionLike | null;
      if (agent) {
        const agentModel = agent.modelConfig?.model;
        if (agentModel && agentModel !== targetModel) {
          targetModel = agentModel;
          await core.initialize({
            sessionId: finalSessionId,
            model: targetModel,
            cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
            approvalMode: coreApprovalMode,
            systemInstruction,
            modelSettings
          });
        }

        const mergedInstruction = [systemInstruction, buildAgentSystemInstruction(agent)]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join('\n\n');
        core.setSystemInstruction(mergedInstruction);
      }
    }

    // DB Setup
    const now = Date.now();
    const sessionBranch = (() => {
      const cwd = workspace && workspace !== 'Default' ? workspace : process.cwd();
      if (!cwd || !existsSync(cwd)) return null;
      try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
          cwd,
          encoding: 'utf-8',
          timeout: 1500,
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim() || null;
      } catch {
        return null;
      }
    })();

    const parseParentId = (rawParentId: unknown): number | null => {
      if (rawParentId === null || rawParentId === undefined) return null;
      const parsed = typeof rawParentId === 'number' ? rawParentId : Number(rawParentId);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      return parsed;
    };

    const requestedParentId = parseParentId(parentId);
    const sessionTitle = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');

    const ensureSessionRow = (timestamp: number) => {
      const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(finalSessionId);
      if (!existing) {
        db.prepare(`
          INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(finalSessionId, sessionTitle, timestamp, timestamp, workspace || null, sessionBranch);
      } else {
        db.prepare('UPDATE sessions SET updated_at = ?, branch = COALESCE(branch, ?) WHERE id = ?')
          .run(timestamp, sessionBranch, finalSessionId);
      }
    };

    ensureSessionRow(now);
    userMessageId = db.prepare(`
      INSERT INTO messages (session_id, role, content, created_at, model, parent_id)
      VALUES (?, 'user', ?, ?, ?, ?)
    `).run(finalSessionId, prompt, now, targetModel, requestedParentId).lastInsertRowid;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Set up message bus to auto-approve tool calls in headless mode
          const messageBus = core.getMessageBus?.();

          if (messageBus) {
            // Listen for tool confirmation requests and auto-approve
            messageBus.on('tool-confirmation-request', async (payload: ToolConfirmationOutcome) => {
              console.log('[headless] Auto-approving tool:', payload.toolName || 'unknown');
              // In headless mode, auto-approve by calling confirm
              try {
                await core.confirmTool(payload.toolCallId || '', true);
              } catch (e) {
                console.warn('[headless] Failed to auto-approve:', e);
              }
            });
          }

          const result = await core.sendMessage(finalPrompt, {
            images,
            onChunk: (chunk: string) => {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
            },
            onToolCall: async (toolCall: unknown) => {
              const toolInfo = toolCall as { name?: string; id?: string; input?: unknown };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'tool-call', tool: toolInfo.name, id: toolInfo.id })}\n\n`));
            },
            onToolResult: async (result: unknown) => {
              const toolResult = result as { toolCallId?: string; output?: string; error?: string };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'tool-result', toolCallId: toolResult.toolCallId, output: toolResult.output, error: toolResult.error })}\n\n`));
            },
          });

          // Save assistant response
          const assistantContent = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
          const assistantMessageId = db.prepare(`
            INSERT INTO messages (session_id, role, content, created_at, model, parent_id)
            VALUES (?, 'assistant', ?, ?, ?, ?)
          `).run(finalSessionId, assistantContent, Date.now(), targetModel, userMessageId).lastInsertRowid;

          // Update session
          db.prepare('UPDATE sessions SET updated_at = ?, title = COALESCE(title, ?) WHERE id = ?')
            .run(Date.now(), sessionTitle, finalSessionId);

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done', messageId: assistantMessageId })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('[headless] Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Headless-Mode': 'true',
      },
    });
  } catch (error) {
    console.error('[headless] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Headless chat failed' }, { status: 500 });
  }
}

export async function GET() {
  // Return headless mode status
  const isHeadless = process.env.GEMINI_HEADLESS === '1' ||
    process.env.GEMINI_HEADLESS === 'true';

  return NextResponse.json({
    headless: isHeadless,
    message: isHeadless
      ? 'Headless mode is enabled. Use POST to send messages.'
      : 'Headless mode is disabled. Set GEMINI_HEADLESS=1 or use --headless flag.',
  });
}
