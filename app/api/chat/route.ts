
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import { getGeminiEnv } from '@/lib/gemini-utils';
import {
  GeminiEventType,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  MessageBusType
} from '@google/gemini-cli-core';

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  try {
    const {
      prompt,
      model,
      systemInstruction,
      sessionId,
      workspace,
      mode,
      approvalMode,
      modelSettings,
      parentId
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Respect the model selected by UI/caller; do not silently downgrade preview models.
    const targetModel = model || 'gemini-2.5-pro';

    // Keep CoreService runtime home aligned with CLI env selection logic (skills/auth consistency).
    const env = getGeminiEnv();
    if (env.GEMINI_CLI_HOME) {
      process.env.GEMINI_CLI_HOME = env.GEMINI_CLI_HOME;
    }

    // Initialize CoreService
    const core = CoreService.getInstance();

    // Use provided sessionId or generate new one
    const finalSessionId = sessionId || crypto.randomUUID();

    await core.initialize({
      sessionId: finalSessionId,
      model: targetModel,
      cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
      // Map legacy/frontend 'auto' to ApprovalMode.AUTO_EDIT ("autoEdit")
      approvalMode: (approvalMode === 'auto' || approvalMode === 'autoEdit') ? 'autoEdit' : 'default',
      systemInstruction
    });

    // Mode specific instructions
    const MODE_INSTRUCTIONS: Record<string, string> = {
      plan: 'You are in PLAN mode. Analyze and plan only — do NOT modify files or run commands.',
      ask: 'You are in ASK mode. Answer questions only — do NOT modify files.'
    };

    let finalPrompt = prompt;
    if (mode && MODE_INSTRUCTIONS[mode]) {
      // We can prepend this to prompt or set as system instruction update
      // For now, prepend to prompt to be safe as system instruction is set in init
      finalPrompt = `[SYSTEM: ${MODE_INSTRUCTIONS[mode]}]\n\n${prompt}`;
    }

    // DB Logging Setup
    const now = Date.now();
    let userMessageId: number | bigint | null = null;
    const parseParentId = (rawParentId: unknown): number | null => {
      if (rawParentId === null || rawParentId === undefined) return null;
      const parsed = typeof rawParentId === 'number' ? rawParentId : Number(rawParentId);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      return parsed;
    };

    const requestedParentId = parseParentId(parentId);
    const validatedParentId = requestedParentId
      ? (() => {
          const parentExists = db
            .prepare('SELECT id FROM messages WHERE id = ? AND session_id = ?')
            .get(requestedParentId, finalSessionId);
          return parentExists ? requestedParentId : null;
        })()
      : null;

    // 1. Log Session & User Message
    try {
      // Use transaction to ensure session exists before message
      const insertSessionFn = db.transaction(() => {
        const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(finalSessionId);
        if (!existing) {
          const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
          db.prepare(`
            INSERT INTO sessions (id, title, created_at, updated_at, workspace)
            VALUES (?, ?, ?, ?, ?)
          `).run(finalSessionId, title, now, now, workspace || null);
        } else {
          db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, finalSessionId);
        }

        const stmt = db.prepare('INSERT INTO messages (session_id, role, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)');
        return stmt.run(finalSessionId, 'user', prompt, validatedParentId, now);
      });

      const info = insertSessionFn();
      userMessageId = info.lastInsertRowid;
    } catch (e) {
      console.error('[DB] Failed to log user/session', e);
      // Don't block chat on DB error
    }

    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        const messageBus = core.messageBus;
        const coreWithConfirmation = core as unknown as {
          subscribeConfirmationRequests?: (
            listener: (request: {
              correlationId: string;
              details: unknown;
              toolCall: unknown;
              serverName?: string;
            }) => void
          ) => () => void;
        };

        const onLegacyToolConfirmationRequest = (request: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'tool_confirmation',
            correlationId: request?.correlationId,
            details: request?.details || {
              type: 'info',
              title: request?.toolCall?.name || 'Tool Confirmation',
              prompt: 'Please confirm this tool call.'
            },
            toolCall: request?.toolCall,
            serverName: request?.serverName
          }) + '\n'));
        };

        const unsubscribeConfirmation =
          typeof coreWithConfirmation.subscribeConfirmationRequests === 'function'
            ? coreWithConfirmation.subscribeConfirmationRequests((request) => {
                controller.enqueue(encoder.encode(JSON.stringify({
                  type: 'tool_confirmation',
                  correlationId: request.correlationId,
                  details: request.details,
                  toolCall: request.toolCall,
                  serverName: request.serverName
                }) + '\n'));
              })
            : () => { };

        const onAskUserRequest = (request: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'ask_user_request',
            correlationId: request?.correlationId,
            questions: request?.questions || [],
            title: 'User Inquiry'
          }) + '\n'));
        };

        if (messageBus) {
          if (typeof coreWithConfirmation.subscribeConfirmationRequests !== 'function') {
            messageBus.subscribe(MessageBusType.TOOL_CONFIRMATION_REQUEST, onLegacyToolConfirmationRequest);
          }
          messageBus.subscribe(MessageBusType.ASK_USER_REQUEST, onAskUserRequest);
        }

        const cleanupMessageBusListeners = () => {
          unsubscribeConfirmation();
          if (!messageBus) return;
          if (typeof coreWithConfirmation.subscribeConfirmationRequests !== 'function') {
            messageBus.unsubscribe(MessageBusType.TOOL_CONFIRMATION_REQUEST, onLegacyToolConfirmationRequest);
          }
          messageBus.unsubscribe(MessageBusType.ASK_USER_REQUEST, onAskUserRequest);
        };

        // Send Init Event
        const initEvent = {
          type: 'init',
          session_id: finalSessionId,
          model: targetModel
        };
        controller.enqueue(encoder.encode(JSON.stringify(initEvent) + '\n'));

        try {
          const generator = core.runTurn(finalPrompt);

          for await (const event of generator) {
            // Map Core Events to Stream JSON

            if (event.type === GeminiEventType.Content) {
              const chunk = event.value; // string
              if (typeof chunk === 'string') {
                fullResponse += chunk;
                controller.enqueue(encoder.encode(JSON.stringify({
                  type: 'message',
                  role: 'assistant',
                  content: chunk
                }) + '\n'));
              }
            }

            else if (event.type === GeminiEventType.ToolCallRequest) {
              const info = event.value as ToolCallRequestInfo;
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'tool_use',
                tool_name: info.name,
                tool_id: info.callId,
                parameters: info.args
              }) + '\n'));
            }

            else if (event.type === GeminiEventType.ToolCallResponse) {
              const info = event.value as ToolCallResponseInfo;
              // Simplify output for frontend
              let output = '';
              // responseParts is Part[]
              if (info.responseParts) {
                output = info.responseParts.map(p => p.text || JSON.stringify(p)).join('');
              }

              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'tool_result',
                tool_id: info.callId,
                status: info.error ? 'error' : 'success',
                is_error: !!info.error,
                output: output || info.error?.message
              }) + '\n'));
            }

            else if (event.type === GeminiEventType.Thought) {
              const thought = event.value as any;
              const text = typeof thought === 'string' ? thought : thought.text || JSON.stringify(thought);
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'thought',
                content: text
              }) + '\n'));
            }

            else if (event.type === GeminiEventType.Citation) {
              const citation = event.value as string;
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'citation',
                content: citation
              }) + '\n'));
            }

            else if (event.type === GeminiEventType.Finished) {
              // model usage metadata
              const val = event.value as any;
              const usage = val.usageMetadata;
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'result',
                status: 'complete',
                stats: {
                  inputTokenCount: usage?.promptTokenCount,
                  outputTokenCount: usage?.candidatesTokenCount,
                  totalTokenCount: usage?.totalTokenCount
                }
              }) + '\n'));
            }

            else if (event.type === GeminiEventType.Error) {
              const eventValue = (event as { value?: unknown }).value;
              const valueRecord = (eventValue && typeof eventValue === 'object')
                ? (eventValue as Record<string, unknown>)
                : null;
              const rawError = (valueRecord?.error ?? eventValue ?? null) as Record<string, unknown> | string | null;
              const normalizedError = typeof rawError === 'string'
                ? { message: rawError }
                : {
                  message: typeof rawError?.message === 'string' ? rawError.message : 'Unknown Gemini error',
                  type: typeof rawError?.type === 'string' ? rawError.type : undefined,
                  ...(rawError || {})
                };

              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'error',
                error: normalizedError
              }) + '\n'));
            }
          }

          // Save Assistant Message to DB
          try {
            db.prepare('INSERT INTO messages (session_id, role, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)')
              .run(finalSessionId, 'model', fullResponse, userMessageId, Date.now());
          } catch (e) {
            console.error('[DB] Failed to log assistant message', e);
          }

        } catch (err) {
          console.error('Turn execution error:', err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            error: { message: errorMessage }
          }) + '\n'));
        } finally {
          cleanupMessageBusListeners();
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
