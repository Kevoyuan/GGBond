
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import { getGeminiEnv } from '@/lib/gemini-utils';
import { calculateCost } from '@/lib/pricing';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  GeminiEventType,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  ToolConfirmationOutcome,
  ToolConfirmationPayload,
  CoreEvent,
  coreEvents,
  ApprovalMode,
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

type FileUndoFallbackEntry = {
  path: string;
  existedBefore: boolean;
  originalContentBase64?: string;
};

function isSameOrChildPath(candidatePath: string, parentPath: string) {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

const GIT_BRANCH_CACHE_TTL_MS = 30_000;
const gitBranchCache = new Map<string, { value: string | null; expiresAt: number }>();

function resolveRequestedModel(requestedModel: string | undefined): string {
  const requested = (requestedModel || '').trim();
  // Keep model routing native: defer model validity/alias handling to core.
  return requested || 'auto';
}

function getCachedGitBranch(cwd: string): string | null {
  if (!cwd || !existsSync(cwd)) {
    return null;
  }

  const normalized = path.resolve(cwd);
  const now = Date.now();
  const cached = gitBranchCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: normalized,
      encoding: 'utf-8',
      timeout: 1500,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || null;
    gitBranchCache.set(normalized, {
      value: branch,
      expiresAt: now + GIT_BRANCH_CACHE_TTL_MS,
    });
    return branch;
  } catch {
    gitBranchCache.set(normalized, {
      value: null,
      expiresAt: now + GIT_BRANCH_CACHE_TTL_MS,
    });
    return null;
  }
}

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
      lowLatencyMode,
      approvalMode,
      modelSettings,
      parentId,
      selectedAgent,
      images
    } = await req.json();

    const isLowLatencyMode = lowLatencyMode !== false;
    if (!isLowLatencyMode) {
      // Debug: Log modelSettings to verify compression settings are received
      console.log('[chat] Received modelSettings:', JSON.stringify(modelSettings));
      console.log('[chat] compressionThreshold:', modelSettings?.compressionThreshold, 'tokenBudget:', modelSettings?.tokenBudget);
    }

    if (!prompt && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'Prompt or images are required' }, { status: 400 });
    }

    // Respect the model selected by UI/caller; do not silently downgrade.
    let targetModel = resolveRequestedModel(model);

    // Keep CoreService runtime home aligned with CLI env selection logic (skills/auth consistency).
    const env = getGeminiEnv();
    if (env.GEMINI_CLI_HOME) {
      process.env.GEMINI_CLI_HOME = env.GEMINI_CLI_HOME;
    }

    // Initialize CoreService
    const core = CoreService.getInstance();

    // Use provided sessionId or generate new one
    const finalSessionId = sessionId || crypto.randomUUID();

    const coreApprovalMode = (() => {
      if (mode === 'plan') return ApprovalMode.PLAN;
      if (approvalMode === 'auto') return ApprovalMode.YOLO;
      if (approvalMode === 'safe') return ApprovalMode.DEFAULT;
      if (approvalMode === ApprovalMode.AUTO_EDIT) return ApprovalMode.AUTO_EDIT;
      if (approvalMode === ApprovalMode.YOLO) return ApprovalMode.YOLO;
      if (approvalMode === ApprovalMode.PLAN) return ApprovalMode.PLAN;
      return ApprovalMode.DEFAULT;
    })();
    if (!isLowLatencyMode) {
      console.log('[chat] approval mode', { requested: approvalMode, resolved: coreApprovalMode });
    }

    await core.initialize({
      sessionId: finalSessionId,
      model: targetModel,
      cwd: (workspace && workspace !== 'Default') ? workspace : process.cwd(),
      // Safe mode asks for confirmation; Auto mode fully allows tool execution.
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
        const requestedAgentModel = resolveRequestedModel(agentModel);
        if (requestedAgentModel && requestedAgentModel !== targetModel) {
          targetModel = requestedAgentModel;
          if (core.config && core.config.getModel() !== targetModel) {
            core.config.setModel(targetModel);
          }
        }

        const mergedInstruction = [systemInstruction, buildAgentSystemInstruction(agent)]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join('\n\n');
        core.setSystemInstruction(mergedInstruction);
      }
    }

    let finalPrompt = prompt;
    if (mode === 'ask') {
      finalPrompt = `[SYSTEM: You are in ASK mode. Answer questions only — do NOT modify files.]\n\n${prompt}`;
    }

    // DB Logging Setup
    const now = Date.now();
    const sessionWorkspace = workspace && workspace !== 'Default' ? workspace : process.cwd();
    const existingSessionRow = db
      .prepare('SELECT id, branch FROM sessions WHERE id = ?')
      .get(finalSessionId) as { id: string; branch: string | null } | undefined;
    const sessionBranch = existingSessionRow?.branch ?? getCachedGitBranch(sessionWorkspace);

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
      if (!existingSessionRow) {
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

        const stmt = db.prepare('INSERT INTO messages (session_id, role, content, images, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
        const serializedImages = images && images.length > 0 ? JSON.stringify(images) : null;
        return stmt.run(finalSessionId, 'user', prompt, serializedImages, effectiveParentId, now);
      });

      const info = insertSessionFn();
      userMessageId = info.lastInsertRowid;
    } catch (e) {
      console.error('[DB] Failed to log user/session', e);
      // Don't block chat on DB error
    }

    // Create background job entry for incremental persistence
    const backgroundJobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let assistantMessageDbId: number | null = null;

    const userMessageDbId =
      typeof userMessageId === 'bigint'
        ? Number(userMessageId)
        : (typeof userMessageId === 'number' ? userMessageId : null);

    try {
      db.prepare(`
        INSERT INTO background_jobs (id, session_id, user_message_id, status, created_at, updated_at)
        VALUES (?, ?, ?, 'running', ?, ?)
      `).run(backgroundJobId, finalSessionId, userMessageDbId, now, now);
    } catch (e) {
      console.error('[DB] Failed to create background job', e);
    }

    // Helper function to persist assistant message incrementally
    const persistAssistantMessageIncremental = async (
      content: string,
      thought?: string,
      toolCalls?: string
    ) => {
      const updateTs = Date.now();
      if (thought !== undefined) {
        persistedAssistantThought = thought;
      }
      const thoughtToPersist = persistedAssistantThought || null;
      try {
        if (assistantMessageDbId === null) {
          // Create new assistant message if doesn't exist
          const insertResult = db.prepare(`
            INSERT INTO messages (session_id, role, content, thought, parent_id, created_at)
            VALUES (?, 'model', ?, ?, ?, ?)
          `).run(finalSessionId, content, thoughtToPersist, userMessageDbId, updateTs);
          assistantMessageDbId = Number(insertResult.lastInsertRowid);

          // Link background job to assistant message
          db.prepare(`
            UPDATE background_jobs SET user_message_id = ?, updated_at = ?
            WHERE id = ?
          `).run(assistantMessageDbId, updateTs, backgroundJobId);
        } else {
          // Update existing assistant message
          db.prepare(`
            UPDATE messages SET content = ?, thought = ?, updated_at = ? WHERE id = ?
          `).run(content, thoughtToPersist, updateTs, assistantMessageDbId);
        }

        // Update background job status
        db.prepare(`
          UPDATE background_jobs SET current_content = ?, current_thought = ?, current_tool_calls = ?, updated_at = ?
          WHERE id = ?
        `).run(content, thoughtToPersist, toolCalls || null, updateTs, backgroundJobId);
      } catch (e) {
        console.error('[DB] Failed to persist assistant message incrementally', e);
      }
    };

    // Mark background job as completed
    const markBackgroundJobCompleted = (error?: string) => {
      const completedTs = Date.now();
      try {
        db.prepare(`
          UPDATE background_jobs SET status = ?, current_content = ?, updated_at = ?, completed_at = ?, error = ?
          WHERE id = ?
        `).run(error ? 'failed' : 'completed', persistedAssistantContent, completedTs, completedTs, error || null, backgroundJobId);
      } catch (e) {
        console.error('[DB] Failed to mark background job completed', e);
      }
    };

    const workspaceRoot = path.resolve((workspace && workspace !== 'Default') ? workspace : process.cwd());
    let undoRestoreId: string | undefined;
    const fallbackFileUndoMap = new Map<string, FileUndoFallbackEntry>();

    if (userMessageDbId && Number.isFinite(userMessageDbId) && userMessageDbId > 0) {
      const checkpointResult = await core.createUndoCheckpoint(`Undo snapshot before message #${userMessageDbId}`);
      if (checkpointResult.success) {
        undoRestoreId = checkpointResult.restoreId;
      } else {
        console.info('[chat] undo checkpoint unavailable, using file-level fallback only:', checkpointResult.error);
      }
    }

    let fullResponse = '';
    let persistedAssistantContent = '';
    let persistedAssistantThought = '';
    const persistedAssistantCitations: string[] = [];
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let persistInFlight = false;
    let persistDirty = false;
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

    const flushIncrementalPersistence = async () => {
      if (persistInFlight) {
        persistDirty = true;
        while (persistInFlight) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        if (!persistDirty) {
          return;
        }
      }
      persistInFlight = true;
      try {
        do {
          persistDirty = false;
          await persistAssistantMessageIncremental(persistedAssistantContent, persistedAssistantThought);
        } while (persistDirty);
      } finally {
        persistInFlight = false;
      }
    };

    const scheduleIncrementalPersistence = () => {
      if (!isLowLatencyMode) {
        return flushIncrementalPersistence();
      }
      if (persistTimer) {
        return Promise.resolve();
      }
      persistTimer = setTimeout(() => {
        persistTimer = null;
        void flushIncrementalPersistence();
      }, 350);
      return Promise.resolve();
    };

    const captureFallbackFileUndo = (resultData: unknown) => {
      if (!resultData || typeof resultData !== 'object') {
        return;
      }

      const payload = resultData as Record<string, unknown>;
      const rawPath = typeof payload.filePath === 'string'
        ? payload.filePath
        : (typeof payload.file_path === 'string' ? payload.file_path : null);
      if (!rawPath) return;

      const normalizedFilePath = path.isAbsolute(rawPath)
        ? path.resolve(rawPath)
        : path.resolve(workspaceRoot, rawPath);
      if (!isSameOrChildPath(normalizedFilePath, workspaceRoot)) {
        return;
      }
      if (fallbackFileUndoMap.has(normalizedFilePath)) {
        // Keep the earliest "before" state for this turn.
        return;
      }

      const originalContent = payload.originalContent;
      const isNewFile = payload.isNewFile === true;
      if (typeof originalContent === 'string') {
        fallbackFileUndoMap.set(normalizedFilePath, {
          path: normalizedFilePath,
          existedBefore: !isNewFile,
          originalContentBase64: Buffer.from(originalContent, 'utf8').toString('base64'),
        });
        return;
      }

      if (isNewFile) {
        fallbackFileUndoMap.set(normalizedFilePath, {
          path: normalizedFilePath,
          existedBefore: false,
        });
      }
    };

    let undoSnapshotPersisted = false;
    const persistUndoSnapshot = () => {
      if (undoSnapshotPersisted) return;
      if (!userMessageDbId || !Number.isFinite(userMessageDbId) || userMessageDbId <= 0) return;

      const fallbackFiles = Array.from(fallbackFileUndoMap.values());
      if (!undoRestoreId && fallbackFiles.length === 0) return;

      try {
        db.prepare(
          `INSERT OR REPLACE INTO undo_snapshots (
             session_id, user_message_id, restore_id, fallback_files, created_at
           ) VALUES (?, ?, ?, ?, ?)`
        ).run(
          finalSessionId,
          userMessageDbId,
          undoRestoreId || null,
          fallbackFiles.length > 0 ? JSON.stringify(fallbackFiles) : null,
          Date.now()
        );
        undoSnapshotPersisted = true;
      } catch (error) {
        console.error('[DB] Failed to persist undo snapshot', error);
      }
    };

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
      }) => `<tool-call id="${encodeURIComponent(id)}" name="${encodeURIComponent(name)}" args="${args}"${checkpointValue ? ` checkpoint="${checkpointValue}"` : ''
        } status="${status}" result="${encodedResult}"${encodedResultData ? ` result_data="${encodedResultData}"` : ''
        } />`;

      if (toolId) {
        const escapedToolId = encodeURIComponent(toolId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactRegex = new RegExp(
          `<tool-call id="${escapedToolId}" name="([^"]*)" args="([^"]*)"(?: checkpoint="([^"]*)")? status="running" \\/>`
        );
        const exactMatch = persistedAssistantContent.match(exactRegex);
        if (exactMatch) {
          persistedAssistantContent = persistedAssistantContent.replace(exactRegex, () =>
            buildToolTag({
              id: toolId,
              name: decodeURIComponent(exactMatch[1]),
              args: exactMatch[2],
              checkpointValue: encodedCheckpoint || exactMatch[3]
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
          id: toolId || decodeURIComponent(fallbackId),
          name: decodeURIComponent(fallbackName),
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
    let cleanupStream = () => { };
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

        let cleanupMessageBusListeners = () => { };
        const pendingConfirmationIds = new Set<string>();
        const toolNameByCallId = new Map<string, string>();
        const checkpointByCallId = new Map<string, string>();
        const toolStartTimeByCallId = new Map<string, number>();
        const pendingHookByKey = new Map<string, Array<{ id: string; startedAt: number }>>();

        // Batch database operations for performance
        const pendingToolStats: Array<{ tool_name: string; session_id: string | null; status: string; error_message: string | null; duration_ms: number; created_at: number }> = [];
        const pendingFileOps: Array<{ file_path: string; operation: string; session_id: string | null; workspace: string | null; created_at: number }> = [];
        let hookCounter = 0;
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
        const onHookStart = (payload: {
          hookName: string;
          eventName: string;
          hookIndex?: number;
          totalHooks?: number;
        }) => {
          const key = `${payload.eventName}:${payload.hookName}`;
          const id = `hook-${Date.now()}-${hookCounter++}`;
          const startedAt = Date.now();
          const queue = pendingHookByKey.get(key) ?? [];
          queue.push({ id, startedAt });
          pendingHookByKey.set(key, queue);

          safeEnqueue({
            type: 'hook_event',
            id,
            name: key,
            hookName: payload.hookName,
            hook_type: 'start',
            input: {
              eventName: payload.eventName,
              hookIndex: payload.hookIndex,
              totalHooks: payload.totalHooks,
            },
          });
        };
        const onHookEnd = (payload: {
          hookName: string;
          eventName: string;
          success: boolean;
        }) => {
          const key = `${payload.eventName}:${payload.hookName}`;
          const queue = pendingHookByKey.get(key) ?? [];
          const started = queue.shift();
          if (queue.length > 0) {
            pendingHookByKey.set(key, queue);
          } else {
            pendingHookByKey.delete(key);
          }

          safeEnqueue({
            type: 'hook_event',
            id: started?.id || `hook-${Date.now()}-${hookCounter++}`,
            name: key,
            hookName: payload.hookName,
            hook_type: 'end',
            output: {
              eventName: payload.eventName,
              success: payload.success,
            },
            duration: started ? Math.max(Date.now() - started.startedAt, 0) : undefined,
          });
        };

        let unsubscribeHookEvents = () => { };
        if (!isLowLatencyMode) {
          coreEvents.on(CoreEvent.HookStart, onHookStart);
          coreEvents.on(CoreEvent.HookEnd, onHookEnd);

          // Subscribe to hook events from CoreService
          unsubscribeHookEvents = core.subscribeHookEvents((payload) => {
            safeEnqueue({
              type: 'hook_event',
              id: `hook-${Date.now()}-${hookCounter++}`,
              hookName: payload.eventName,
              name: payload.eventName,
              hook_type: 'start',
              input: payload.data,
              sessionId: payload.sessionId,
            });
          });
        }

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
            unsubscribeHookEvents();
            if (!isLowLatencyMode) {
              coreEvents.off(CoreEvent.HookStart, onHookStart);
              coreEvents.off(CoreEvent.HookEnd, onHookEnd);
            }
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
            model: targetModel,
            selected_agent: selectedAgentName || null
          };
          safeEnqueue(initEvent);

          const turnStartedAt = Date.now();
          const generator = core.runTurn(finalPrompt, turnAbortController.signal, images);
          let hasStreamError = false;

          for await (const event of generator) {
            // Map Core Events to Stream JSON

            if (event.type === GeminiEventType.Content) {
              const chunk = event.value; // string
              if (typeof chunk === 'string') {
                const escapedChunk = chunk.replace(/</g, '&lt;');
                fullResponse += chunk;
                persistedAssistantContent += escapedChunk;
                safeEnqueue({
                  type: 'message',
                  role: 'assistant',
                  content: escapedChunk
                });
                // Extreme low-latency: avoid per-chunk persistence.
                if (!isLowLatencyMode) {
                  await scheduleIncrementalPersistence();
                }
              }
            }

            else if (event.type === GeminiEventType.ToolCallRequest) {
              const info = event.value as ToolCallRequestInfo;
              toolNameByCallId.set(info.callId, info.name);
              toolStartTimeByCallId.set(info.callId, Date.now());
              if (typeof info.checkpoint === 'string' && info.checkpoint) {
                checkpointByCallId.set(info.callId, info.checkpoint);
              }
              const encodedCheckpoint = (typeof info.checkpoint === 'string' && info.checkpoint)
                ? ` checkpoint="${encodeURIComponent(info.checkpoint)}"`
                : '';
              const toolCallTag = `\n\n<tool-call id="${encodeURIComponent(info.callId || '')}" name="${encodeURIComponent(info.name)}" args="${encodeURIComponent(JSON.stringify(info.args || {}))}"${encodedCheckpoint} status="running" />\n\n`;
              persistedAssistantContent += toolCallTag;
              safeEnqueue({
                type: 'tool_use',
                tool_name: info.name,
                tool_id: info.callId,
                checkpoint: info.checkpoint,
                parameters: info.args
              });
              // Persist with throttling in low-latency mode to reduce stream stalls.
              await scheduleIncrementalPersistence();
            }

            else if (event.type === GeminiEventType.ToolCallResponse) {
              const info = event.value as ToolCallResponseInfo;
              const resultDisplay = info.resultDisplay;
              const resultData = toSerializableResultData(resultDisplay);
              captureFallbackFileUndo(resultData);
              const output = toResultOutput(resultDisplay);
              const toolName = toolNameByCallId.get(info.callId);
              const checkpoint = checkpointByCallId.get(info.callId);
              toolNameByCallId.delete(info.callId);
              checkpointByCallId.delete(info.callId);
              toolStartTimeByCallId.delete(info.callId);
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

              // Collect tool stats for batch insert
              const startTime = toolStartTimeByCallId.get(info.callId) || Date.now();
              const durationMs = Date.now() - startTime;
              pendingToolStats.push({
                tool_name: toolName || 'unknown',
                session_id: sessionId || null,
                status: info.error ? 'failed' : 'success',
                error_message: info.error?.message || null,
                duration_ms: durationMs,
                created_at: Date.now()
              });

              // Collect file operations for batch insert
              if (resultData && typeof resultData === 'object') {
                const rd = resultData as Record<string, unknown>;
                const filePath = (rd.file_path as string) || (rd.path as string);
                const operation = (rd.operation as string) || (rd.tool as string) || toolName;
                if (filePath && operation) {
                  pendingFileOps.push({
                    file_path: filePath,
                    operation: operation,
                    session_id: sessionId || null,
                    workspace: workspace || null,
                    created_at: Date.now()
                  });
                }
              }
              // Persist at key tool boundary for crash continuity.
              await scheduleIncrementalPersistence();
            }

            else if (event.type === GeminiEventType.Thought) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const thought = event.value as any;
              const text = typeof thought === 'string' ? thought : thought.text || JSON.stringify(thought);
              const escapedText = text.replace(/</g, '&lt;');
              persistedAssistantThought += escapedText;
              safeEnqueue({
                type: 'thought',
                content: escapedText
              });
              // Extreme low-latency: avoid per-thought persistence.
              if (!isLowLatencyMode) {
                await scheduleIncrementalPersistence();
              }
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            else if (event.type === GeminiEventType.ChatCompressed) {
              // Context was compressed, notify UI to refresh
              const compressionInfo = event.value as { originalTokenCount?: number; newTokenCount?: number; compressionRate?: number };
              if (!isLowLatencyMode) {
                console.log('[chat] Context compressed:', compressionInfo);
              }

              // Emit PreCompress hook event before compression
              core.emitHookEvent('PreCompress', {
                originalTokenCount: compressionInfo?.originalTokenCount,
                compressionRate: compressionInfo?.compressionRate,
              });

              safeEnqueue({
                type: 'context_compressed',
                originalTokenCount: compressionInfo?.originalTokenCount,
                newTokenCount: compressionInfo?.newTokenCount,
                compressionRate: compressionInfo?.compressionRate
              });
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

          const turnWasAborted = turnAbortController.signal.aborted;

          // Mark background job as completed or aborted
          if (hasStreamError) {
            markBackgroundJobCompleted('stream_error');
          } else if (turnWasAborted) {
            markBackgroundJobCompleted('aborted');
          } else {
            markBackgroundJobCompleted();
          }

          if (!hasStreamError && !turnWasAborted) {
            safeEnqueue({
              type: 'result',
              status: 'complete',
              stats: finalStats ?? undefined
            });
          }

          // Save Assistant Message to DB
          try {
            if (persistTimer) {
              clearTimeout(persistTimer);
              persistTimer = null;
            }
            if (
              assistantMessageDbId !== null ||
              persistedAssistantContent.trim() ||
              persistedAssistantThought.trim()
            ) {
              await flushIncrementalPersistence();
            }

            const serializedCitations = persistedAssistantCitations.length > 0
              ? JSON.stringify(Array.from(new Set(persistedAssistantCitations)))
              : null;
            const assistantContentToPersist = persistedAssistantContent || fullResponse || '';
            const hasAssistantPayload = Boolean(
              assistantContentToPersist.trim() ||
              persistedAssistantThought.trim() ||
              serializedCitations ||
              finalStats
            );

            if (!hasAssistantPayload) {
              return;
            }

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

              if (assistantMessageDbId !== null) {
                // Update existing message created during streaming
                db.prepare(
                  `UPDATE messages SET 
                    content = ?, 
                    stats = ?, 
                    thought = ?, 
                    citations = ?, 
                    updated_at = ? 
                   WHERE id = ?`
                ).run(
                  assistantContentToPersist,
                  finalStats ? JSON.stringify(finalStats) : null,
                  persistedAssistantThought || null,
                  serializedCitations,
                  insertTs,
                  assistantMessageDbId
                );
              } else {
                // Fallback: Create new message if for some reason incremental persistence was skipped
                db.prepare(
                  'INSERT INTO messages (session_id, role, content, stats, thought, citations, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(
                  finalSessionId,
                  'model',
                  assistantContentToPersist,
                  finalStats ? JSON.stringify(finalStats) : null,
                  persistedAssistantThought || null,
                  serializedCitations,
                  effectiveParentId,
                  insertTs
                );
              }
            });

            assistantInsertTx();
          } catch (e) {
            console.error('[DB] Failed to log assistant message', e);
          }

        } catch (err) {
          const isAbortError =
            (err instanceof DOMException && err.name === 'AbortError') ||
            (err instanceof Error && err.name === 'AbortError') ||
            turnAbortController.signal.aborted;

          if (!isAbortError) {
            console.error('Turn execution error:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            safeEnqueue({
              type: 'error',
              error: { message: errorMessage }
            });
            // Mark background job as failed
            markBackgroundJobCompleted(errorMessage);
          } else {
            // Mark as aborted
            markBackgroundJobCompleted('aborted');
          }
        } finally {
          persistUndoSnapshot();

          // Batch insert collected tool stats and file operations
          if (pendingToolStats.length > 0 || pendingFileOps.length > 0) {
            try {
              const batchInsertTx = db.transaction(() => {
                // Batch insert tool stats
                if (pendingToolStats.length > 0) {
                  const toolStmt = db.prepare(`
                    INSERT INTO tool_stats (tool_name, session_id, status, error_message, duration_ms, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `);
                  for (const stat of pendingToolStats) {
                    toolStmt.run(stat.tool_name, stat.session_id, stat.status, stat.error_message, stat.duration_ms, stat.created_at);
                  }
                }

                // Batch insert file operations
                if (pendingFileOps.length > 0) {
                  const fileStmt = db.prepare(`
                    INSERT INTO file_ops (file_path, operation, session_id, workspace, created_at)
                    VALUES (?, ?, ?, ?, ?)
                  `);
                  for (const op of pendingFileOps) {
                    fileStmt.run(op.file_path, op.operation, op.session_id, op.workspace, op.created_at);
                  }
                }
              });
              batchInsertTx();
            } catch (err) {
              console.error('[DB] Failed to batch insert stats:', err);
            }
          }

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
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
