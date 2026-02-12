
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import { getGeminiEnv } from '@/lib/gemini-utils';
import { calculateCost } from '@/lib/pricing';
import {
  GeminiEventType,
  MessageBusType,
  ToolCallRequestInfo,
  ToolCallResponseInfo
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

    const coreApprovalMode = approvalMode === 'auto' ? 'yolo' : 'default';
    console.log('[chat] approval mode', { requested: approvalMode, resolved: coreApprovalMode });

    await core.initialize({
      sessionId: finalSessionId,
      model: targetModel,
      cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
      // Safe mode asks for confirmation; Auto mode fully allows tool execution.
      approvalMode: coreApprovalMode,
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
    let finalStats: {
      input_tokens: number;
      output_tokens: number;
      cached_content_token_count: number;
      total_tokens: number;
      duration_ms: number;
      model: string;
      totalCost: number;
      inputTokenCount: number;
      outputTokenCount: number;
      cachedContentTokenCount: number;
      totalTokenCount: number;
      durationMs: number;
    } | null = null;

    let streamClosed = false;
    let cleanupStream = () => {};
    const turnAbortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const messageBus = core.messageBus;
        const coreWithConfirmation = core as unknown as {
          clearConfirmationSubscribers?: () => void;
          subscribeConfirmationRequests?: (
            listener: (request: {
              correlationId: string;
              details: unknown;
              toolCall: unknown;
              serverName?: string;
            }) => void
          ) => () => void;
        };

        // This app handles one active turn stream per browser session.
        // Clearing stale subscribers prevents closed-controller callbacks from prior turns.
        coreWithConfirmation.clearConfirmationSubscribers?.();

        let cleanupMessageBusListeners = () => {};
        const safeEnqueue = (payload: unknown) => {
          if (streamClosed) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
          } catch (error) {
            streamClosed = true;
            cleanupMessageBusListeners();
            console.warn('[chat/stream] enqueue skipped after close');
          }
        };
        const hasConfirmationSubscription =
          typeof coreWithConfirmation.subscribeConfirmationRequests === 'function';

        if (!hasConfirmationSubscription) {
          console.warn('[chat/stream] subscribeConfirmationRequests unavailable; falling back to MessageBus bridge');
        }

        const unsubscribeConfirmation = hasConfirmationSubscription
          ? coreWithConfirmation.subscribeConfirmationRequests!((request) => {
            safeEnqueue({
              type: 'tool_confirmation',
              correlationId: request.correlationId,
              details: request.details,
              toolCall: request.toolCall,
              serverName: request.serverName
            });
          })
          : () => { };

        const onLegacyToolConfirmationRequest = (request: any) => {
          safeEnqueue({
            type: 'tool_confirmation',
            correlationId: request?.correlationId,
            details: request?.details || {
              type: 'info',
              title: request?.toolCall?.name || 'Tool Confirmation',
              prompt: 'Please confirm this tool call.'
            },
            toolCall: request?.toolCall,
            serverName: request?.serverName
          });
        };

        const onAskUserRequest = (request: any) => {
          safeEnqueue({
            type: 'ask_user_request',
            correlationId: request?.correlationId,
            questions: request?.questions || [],
            title: request?.title || 'User Inquiry'
          });
        };

        if (messageBus && !hasConfirmationSubscription) {
          messageBus.subscribe(MessageBusType.TOOL_CONFIRMATION_REQUEST, onLegacyToolConfirmationRequest);
          messageBus.subscribe(MessageBusType.ASK_USER_REQUEST, onAskUserRequest);
        }

        cleanupMessageBusListeners = () => {
          unsubscribeConfirmation();
          if (messageBus && !hasConfirmationSubscription) {
            messageBus.unsubscribe(MessageBusType.TOOL_CONFIRMATION_REQUEST, onLegacyToolConfirmationRequest);
            messageBus.unsubscribe(MessageBusType.ASK_USER_REQUEST, onAskUserRequest);
          }
        };

        cleanupStream = () => {
          cleanupMessageBusListeners();
          if (!turnAbortController.signal.aborted) {
            turnAbortController.abort();
          }
        };

        // Send Init Event
        const initEvent = {
          type: 'init',
          session_id: finalSessionId,
          model: targetModel
        };
        safeEnqueue(initEvent);

        try {
          const turnStartedAt = Date.now();
          const generator = core.runTurn(finalPrompt, turnAbortController.signal);

          for await (const event of generator) {
            // Map Core Events to Stream JSON

            if (event.type === GeminiEventType.Content) {
              const chunk = event.value; // string
              if (typeof chunk === 'string') {
                fullResponse += chunk;
                safeEnqueue({
                  type: 'message',
                  role: 'assistant',
                  content: chunk
                });
              }
            }

            else if (event.type === GeminiEventType.ToolCallRequest) {
              const info = event.value as ToolCallRequestInfo;
              safeEnqueue({
                type: 'tool_use',
                tool_name: info.name,
                tool_id: info.callId,
                parameters: info.args
              });
            }

            else if (event.type === GeminiEventType.ToolCallResponse) {
              const info = event.value as ToolCallResponseInfo;
              // Simplify output for frontend
              let output = '';
              // responseParts is Part[]
              if (info.responseParts) {
                output = info.responseParts.map(p => p.text || JSON.stringify(p)).join('');
              }

              safeEnqueue({
                type: 'tool_result',
                tool_id: info.callId,
                status: info.error ? 'error' : 'success',
                is_error: !!info.error,
                output: output || info.error?.message
              });
            }

            else if (event.type === GeminiEventType.Thought) {
              const thought = event.value as any;
              const text = typeof thought === 'string' ? thought : thought.text || JSON.stringify(thought);
              safeEnqueue({
                type: 'thought',
                content: text
              });
            }

            else if (event.type === GeminiEventType.Citation) {
              const citation = event.value as string;
              safeEnqueue({
                type: 'citation',
                content: citation
              });
            }

            else if (event.type === GeminiEventType.Finished) {
              // model usage metadata
              const val = event.value as any;
              const usage = val.usageMetadata;
              const inputTokenCount = usage?.promptTokenCount || 0;
              const outputTokenCount = usage?.candidatesTokenCount || 0;
              const cachedContentTokenCount = usage?.cachedContentTokenCount || 0;
              const totalTokenCount = usage?.totalTokenCount || (inputTokenCount + outputTokenCount);
              const durationMs = Math.max(Date.now() - turnStartedAt, 0);
              const totalCost = calculateCost(
                inputTokenCount,
                outputTokenCount,
                cachedContentTokenCount,
                targetModel
              );

              finalStats = {
                input_tokens: inputTokenCount,
                output_tokens: outputTokenCount,
                cached_content_token_count: cachedContentTokenCount,
                total_tokens: totalTokenCount,
                duration_ms: durationMs,
                model: targetModel,
                totalCost,
                inputTokenCount,
                outputTokenCount,
                cachedContentTokenCount,
                totalTokenCount,
                durationMs
              };

              safeEnqueue({
                type: 'result',
                status: 'complete',
                stats: finalStats
              });
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

              safeEnqueue({
                type: 'error',
                error: normalizedError
              });
            }
          }

          // Save Assistant Message to DB
          try {
            db.prepare('INSERT INTO messages (session_id, role, content, stats, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
              .run(
                finalSessionId,
                'model',
                fullResponse,
                finalStats ? JSON.stringify(finalStats) : null,
                userMessageId,
                Date.now()
              );
          } catch (e) {
            console.error('[DB] Failed to log assistant message', e);
          }

        } catch (err) {
          console.error('Turn execution error:', err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          safeEnqueue({
            type: 'error',
            error: { message: errorMessage }
          });
        } finally {
          cleanupStream();
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        }
      },
      cancel() {
        if (streamClosed) return;
        streamClosed = true;
        cleanupStream();
      },
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
