
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import { getGeminiEnv } from '@/lib/gemini-utils';
import { calculateCost } from '@/lib/pricing';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import {
  GeminiEventType,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  ToolConfirmationOutcome,
  ToolConfirmationPayload
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

    let userMessageId: number | bigint | null = null;
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

    // 1. Log Session & User Message
    try {
      // Use transaction to ensure session exists before message
      const insertSessionFn = db.transaction(() => {
        ensureSessionRow(now);
        const effectiveParentId = requestedParentId
          ? (() => {
              const parentExists = db
                .prepare('SELECT id FROM messages WHERE id = ? AND session_id = ?')
                .get(requestedParentId, finalSessionId);
              return parentExists ? requestedParentId : null;
            })()
          : null;

        const stmt = db.prepare('INSERT INTO messages (session_id, role, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)');
        return stmt.run(finalSessionId, 'user', prompt, effectiveParentId, now);
      });

      const info = insertSessionFn();
      userMessageId = info.lastInsertRowid;
    } catch (e) {
      console.error('[DB] Failed to log user/session', e);
      // Don't block chat on DB error
    }

    let fullResponse = '';
    let persistedAssistantContent = '';
    let persistedAssistantThought = '';
    const persistedAssistantCitations: string[] = [];
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

    const upsertToolCallResult = ({
      toolId,
      checkpoint,
      status,
      output,
      resultData,
    }: {
      toolId?: string;
      checkpoint?: string;
      status: 'completed' | 'failed';
      output?: string;
      resultData?: unknown;
    }) => {
      const encodedResult = encodeURIComponent(output || '');
      const encodedCheckpoint = checkpoint ? encodeURIComponent(checkpoint) : undefined;
      let encodedResultData: string | undefined;
      if (resultData !== undefined) {
        try {
          encodedResultData = encodeURIComponent(JSON.stringify(resultData));
        } catch {
          encodedResultData = undefined;
        }
      }
      const buildToolTag = ({
        id,
        name,
        args,
        checkpointValue,
      }: {
        id: string;
        name: string;
        args: string;
        checkpointValue?: string;
      }) => `<tool-call id="${id}" name="${name}" args="${args}"${
        checkpointValue ? ` checkpoint="${checkpointValue}"` : ''
      } status="${status}" result="${encodedResult}"${
        encodedResultData ? ` result_data="${encodedResultData}"` : ''
      } />`;

      if (toolId) {
        const escapedToolId = toolId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactRegex = new RegExp(
          `<tool-call id="${escapedToolId}" name="([^"]*)" args="([^"]*)"(?: checkpoint="([^"]*)")? status="running" \\/>`
        );
        const exactMatch = persistedAssistantContent.match(exactRegex);
        if (exactMatch) {
          persistedAssistantContent = persistedAssistantContent.replace(exactRegex, (_full, name, args, existingCheckpoint) =>
            buildToolTag({
              id: toolId,
              name,
              args,
              checkpointValue: encodedCheckpoint || existingCheckpoint
            })
          );
          return;
        }
      }

      const fallbackRegex = /<tool-call id="([^"]*)" name="([^"]*)" args="([^"]*)"(?: checkpoint="([^"]*)")? status="running" \/>/g;
      let match: RegExpExecArray | null;
      let lastMatch: RegExpExecArray | null = null;

      while ((match = fallbackRegex.exec(persistedAssistantContent)) !== null) {
        lastMatch = match;
      }

      if (lastMatch) {
        const [fullMatch, fallbackId, fallbackName, fallbackArgs, fallbackCheckpoint] = lastMatch;
        const updatedTag = buildToolTag({
          id: toolId || fallbackId,
          name: fallbackName,
          args: fallbackArgs,
          checkpointValue: encodedCheckpoint || fallbackCheckpoint
        });
        persistedAssistantContent =
          persistedAssistantContent.slice(0, lastMatch.index) +
          updatedTag +
          persistedAssistantContent.slice(lastMatch.index + fullMatch.length);
      }
    };

    let streamClosed = false;
    let cleanupStream = () => {};
    const turnAbortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
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
        const pendingConfirmationIds = new Set<string>();
        const toolNameByCallId = new Map<string, string>();
        const checkpointByCallId = new Map<string, string>();
        let isPollingConfirmationQueue = false;
        let confirmationQueuePollTimer: ReturnType<typeof setInterval> | null = null;
        const toSerializableResultData = (value: unknown): unknown => {
          if (value === undefined) {
            return undefined;
          }
          if (typeof value === 'string') {
            return value;
          }
          try {
            return JSON.parse(JSON.stringify(value));
          } catch {
            return undefined;
          }
        };
        const toResultOutput = (value: unknown): string | undefined => {
          if (typeof value === 'string') {
            return value;
          }
          if (value === undefined || value === null) {
            return undefined;
          }
          try {
            return JSON.stringify(value, null, 2);
          } catch {
            return String(value);
          }
        };
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
        const processQueuedConfirmations = async () => {
          if (isPollingConfirmationQueue || pendingConfirmationIds.size === 0) {
            return;
          }
          isPollingConfirmationQueue = true;
          try {
            const ids = Array.from(pendingConfirmationIds);
            const placeholders = ids.map(() => '?').join(', ');
            const queuedRows = db.prepare(
              `SELECT correlation_id, confirmed, outcome, payload
               FROM confirmation_queue
               WHERE correlation_id IN (${placeholders})`
            ).all(...ids) as Array<{
              correlation_id: string;
              confirmed: number;
              outcome: string | null;
              payload: string | null;
            }>;

            for (const row of queuedRows) {
              let parsedPayload: Record<string, unknown> | undefined;
              if (row.payload) {
                try {
                  parsedPayload = JSON.parse(row.payload) as Record<string, unknown>;
                } catch (error) {
                  console.warn('[chat/stream] Failed to parse queued confirmation payload', {
                    correlationId: row.correlation_id,
                    error: error instanceof Error ? error.message : String(error),
                  });
                }
              }

              await core.submitConfirmation(
                row.correlation_id,
                row.confirmed === 1,
                (row.outcome ?? undefined) as ToolConfirmationOutcome | undefined,
                parsedPayload as ToolConfirmationPayload | undefined
              );
              pendingConfirmationIds.delete(row.correlation_id);
              db.prepare('DELETE FROM confirmation_queue WHERE correlation_id = ?').run(row.correlation_id);
            }
          } catch (error) {
            console.error('[chat/stream] Failed to process queued confirmations', error);
          } finally {
            isPollingConfirmationQueue = false;
          }
        };
        try {
          if (typeof coreWithConfirmation.subscribeConfirmationRequests !== 'function') {
            throw new Error('CoreService confirmation subscription is unavailable');
          }

          const unsubscribeConfirmation = coreWithConfirmation.subscribeConfirmationRequests((request) => {
            pendingConfirmationIds.add(request.correlationId);
            safeEnqueue({
              type: 'tool_confirmation',
              correlationId: request.correlationId,
              details: request.details,
              toolCall: request.toolCall,
              serverName: request.serverName
            });
          });

          confirmationQueuePollTimer = setInterval(() => {
            void processQueuedConfirmations();
          }, 250);

          cleanupMessageBusListeners = () => {
            unsubscribeConfirmation();
            if (confirmationQueuePollTimer) {
              clearInterval(confirmationQueuePollTimer);
              confirmationQueuePollTimer = null;
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

          const turnStartedAt = Date.now();
          const generator = core.runTurn(finalPrompt, turnAbortController.signal);
          let hasStreamError = false;

          for await (const event of generator) {
            // Map Core Events to Stream JSON

            if (event.type === GeminiEventType.Content) {
              const chunk = event.value; // string
              if (typeof chunk === 'string') {
                fullResponse += chunk;
                persistedAssistantContent += chunk;
                safeEnqueue({
                  type: 'message',
                  role: 'assistant',
                  content: chunk
                });
              }
            }

            else if (event.type === GeminiEventType.ToolCallRequest) {
              const info = event.value as ToolCallRequestInfo;
              toolNameByCallId.set(info.callId, info.name);
              if (typeof info.checkpoint === 'string' && info.checkpoint) {
                checkpointByCallId.set(info.callId, info.checkpoint);
              }
              const encodedCheckpoint = (typeof info.checkpoint === 'string' && info.checkpoint)
                ? ` checkpoint="${encodeURIComponent(info.checkpoint)}"`
                : '';
              const toolCallTag = `\n\n<tool-call id="${info.callId || ''}" name="${info.name}" args="${encodeURIComponent(JSON.stringify(info.args || {}))}"${encodedCheckpoint} status="running" />\n\n`;
              persistedAssistantContent += toolCallTag;
              safeEnqueue({
                type: 'tool_use',
                tool_name: info.name,
                tool_id: info.callId,
                checkpoint: info.checkpoint,
                parameters: info.args
              });
            }

            else if (event.type === GeminiEventType.ToolCallResponse) {
              const info = event.value as ToolCallResponseInfo;
              const resultDisplay = info.resultDisplay;
              const resultData = toSerializableResultData(resultDisplay);
              const output = toResultOutput(resultDisplay);
              const toolName = toolNameByCallId.get(info.callId);
              const checkpoint = checkpointByCallId.get(info.callId);
              toolNameByCallId.delete(info.callId);
              checkpointByCallId.delete(info.callId);
              const error =
                info.error
                  ? {
                      type: info.errorType || 'tool_error',
                      message: info.error.message || String(info.error)
                    }
                  : undefined;
              upsertToolCallResult({
                toolId: info.callId,
                checkpoint,
                status: info.error ? 'failed' : 'completed',
                output: output || info.error?.message,
                resultData,
              });

              safeEnqueue({
                type: 'tool_result',
                tool_id: info.callId,
                tool_name: toolName,
                checkpoint,
                status: info.error ? 'error' : 'success',
                is_error: !!info.error,
                output: output || info.error?.message,
                result_data: resultData,
                error
              });
            }

            else if (event.type === GeminiEventType.Thought) {
              const thought = event.value as any;
              const text = typeof thought === 'string' ? thought : thought.text || JSON.stringify(thought);
              persistedAssistantThought += text;
              safeEnqueue({
                type: 'thought',
                content: text
              });
            }

            else if (event.type === GeminiEventType.Citation) {
              const citation = event.value as string;
              if (citation) {
                persistedAssistantCitations.push(citation);
              }
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
            }

            else if (event.type === GeminiEventType.Error) {
              hasStreamError = true;
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

          if (!hasStreamError) {
            safeEnqueue({
              type: 'result',
              status: 'complete',
              stats: finalStats ?? undefined
            });
          }

          // Save Assistant Message to DB
          try {
            const serializedCitations = persistedAssistantCitations.length > 0
              ? JSON.stringify(Array.from(new Set(persistedAssistantCitations)))
              : null;
            const assistantInsertTx = db.transaction(() => {
              const insertTs = Date.now();
              ensureSessionRow(insertTs);

              const effectiveParentId = userMessageId == null
                ? null
                : (() => {
                    const parentExists = db
                      .prepare('SELECT id FROM messages WHERE id = ? AND session_id = ?')
                      .get(userMessageId, finalSessionId);
                    return parentExists ? userMessageId : null;
                  })();

              db.prepare(
                'INSERT INTO messages (session_id, role, content, stats, thought, citations, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              )
                .run(
                  finalSessionId,
                  'model',
                  persistedAssistantContent || fullResponse,
                  finalStats ? JSON.stringify(finalStats) : null,
                  persistedAssistantThought || null,
                  serializedCitations,
                  effectiveParentId,
                  insertTs
                );
            });

            assistantInsertTx();
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
