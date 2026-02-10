
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import db from '@/lib/db';
import {
  GeminiEventType,
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

    // Initialize CoreService
    const core = CoreService.getInstance();

    // Use provided sessionId or generate new one if not provided (though usually frontend provides one or null)
    const finalSessionId = sessionId || crypto.randomUUID();

    // Initialize config if needed or if session changed
    await core.initialize({
      sessionId: finalSessionId,
      model: model || 'gemini-2.5-pro',
      cwd: workspace || process.cwd(),
      approvalMode: approvalMode === 'auto' ? 1 : 0, // 1=AUTO, 0=CONFIRM (Need to check Enum values, assuming 1 is AUTO)
      // Enum ApprovalMode { ALWAYS_CONFIRM = 0, AUTO_APPROVE = 1, YOLO = 2 }
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

    // 1. Log Session & User Message (Synchronously before stream or during init)
    try {
      const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(finalSessionId);
      if (!existingSession) {
        const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
        db.prepare(`
                    INSERT INTO sessions (id, title, created_at, updated_at, workspace)
                    VALUES (?, ?, ?, ?, ?)
                `).run(finalSessionId, title, now, now, workspace || null);
      } else {
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, finalSessionId);
      }

      const stmt = db.prepare('INSERT INTO messages (session_id, role, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(finalSessionId, 'user', prompt, parentId || null, now);
      userMessageId = info.lastInsertRowid;
    } catch (e) {
      console.error('[DB] Failed to log user message', e);
    }

    let fullResponse = '';
    let toolCalls = [];

    const stream = new ReadableStream({
      async start(controller) {
        // Send Init Event
        const initEvent = {
          type: 'init',
          session_id: finalSessionId,
          model: model || 'gemini-2.5-pro'
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
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'error',
                error: event.value.error
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
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            error: { message: String(err) }
          }) + '\n'));
        } finally {
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
