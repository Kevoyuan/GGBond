import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import db from '@/lib/db';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';

export async function POST(req: Request) {
  try {
    // Extract parentId from request
    const { prompt, model, systemInstruction, sessionId, workspace, mode, approvalMode, modelSettings, parentId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Mode-specific system instructions
    const MODE_INSTRUCTIONS: Record<string, string> = {
      plan: 'You are in PLAN mode. Analyze and plan only — do NOT modify files or run commands. Produce a detailed plan with steps.',
      ask: 'You are in ASK mode. Answer questions only — do NOT modify files, run commands, or make any changes.',
    };

    // Check max session turns if configured
    if (sessionId && modelSettings?.maxSessionTurns > 0) {
      try {
        const result = db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ? AND role = ?').get(sessionId, 'user') as { count: number };
        if (result && result.count >= modelSettings.maxSessionTurns) {
          return NextResponse.json({
            error: `Session turn limit reached (${modelSettings.maxSessionTurns} turns). Please start a new chat.`
          }, { status: 403 });
        }
      } catch (e) {
        console.error('Failed to check session turns:', e);
      }
    }

    // Resolve gemini executable path
    let geminiScriptPath = '';
    try {
      geminiScriptPath = getGeminiPath();
    } catch {
      console.error('Failed to find gemini executable');
      return NextResponse.json({ error: 'Gemini CLI not found' }, { status: 500 });
    }

    // Construct arguments
    const args = [geminiScriptPath, '--output-format', 'stream-json'];

    // Add model if provided
    if (model) {
      args.push('--model', model);
    }

    // Handle Auto-Approve (YOLO) mode
    if (approvalMode === 'auto') {
      args.push('--yolo');
    }

    // Add prompt (prepend system instruction + mode instruction if present)
    let fullPrompt = prompt;
    const modeInstruction = mode && MODE_INSTRUCTIONS[mode] ? MODE_INSTRUCTIONS[mode] : '';
    if (systemInstruction || modeInstruction) {
      const combinedInstruction = [modeInstruction, systemInstruction].filter(Boolean).join('\n');
      fullPrompt = `System Instruction: ${combinedInstruction}\n\nUser Request: ${prompt}`;
    }
    args.push('-p', fullPrompt);

    // Resume session if ID provided
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    // Get environment variables with keychain bypass
    const env = getGeminiEnv();

    console.log('Running gemini with HOME:', env.HOME || process.env.HOME);
    console.log('Script path:', geminiScriptPath);

    const encoder = new TextEncoder();
    let fullResponseContent = '';
    let finalStats: any = null;
    let detectedSessionId = sessionId;
    let detectedModel = model || ''; // Use requested model or capture from init
    let userMessageId: number | bigint | null = null;
    let userMessageSaved = false;

    const stream = new ReadableStream({
      start(controller) {
        const spawnOptions: { env: typeof env; cwd?: string } = { env };
        if (workspace) {
          spawnOptions.cwd = workspace;
        }
        const gemini = spawn(process.execPath, args, spawnOptions);

        let lineBuffer = '';

        gemini.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          lineBuffer += chunk;
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            // Forward to client
            controller.enqueue(encoder.encode(line + '\n'));

            try {
              const parsed = JSON.parse(line);

              // 1. Handle Init -> Save Session & User Message
              if (parsed.type === 'init') {
                if (parsed.session_id) detectedSessionId = parsed.session_id;
                if (parsed.model) detectedModel = parsed.model;

                if (detectedSessionId) {
                  try {
                    const now = Date.now();
                    const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(detectedSessionId);

                    if (!existingSession) {
                      const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
                      db.prepare(`
                        INSERT INTO sessions (id, title, created_at, updated_at, workspace)
                        VALUES (?, ?, ?, ?, ?)
                      `).run(detectedSessionId, title, now, now, workspace || null);
                    } else {
                      db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, detectedSessionId);
                    }

                    if (!userMessageSaved) {
                      const stmt = db.prepare('INSERT INTO messages (session_id, role, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?)');
                      const info = stmt.run(
                        detectedSessionId,
                        'user',
                        prompt,
                        parentId || null,
                        now
                      );
                      userMessageId = info.lastInsertRowid;
                      userMessageSaved = true;
                    }
                  } catch (dbErr) {
                    console.error('DB Error on init:', dbErr);
                  }
                }
              }

              // 2. Accumulate Content
              if (parsed.type === 'message' && parsed.role === 'assistant' && parsed.content) {
                fullResponseContent += parsed.content;
              }

              // 3. Handle Result -> Save Assistant Message
              if (parsed.type === 'result') {
                finalStats = parsed.stats;
                // Inject model into stats if available
                if (finalStats && detectedModel) {
                  finalStats.model = detectedModel;
                }

                try {
                  const now = Date.now();
                  if (detectedSessionId) {
                    db.prepare('INSERT INTO messages (session_id, role, content, stats, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                      detectedSessionId,
                      'model',
                      fullResponseContent,
                      finalStats ? JSON.stringify(finalStats) : null,
                      userMessageId, // Use user message as parent
                      now + 1
                    );
                  }
                } catch (dbErr) {
                  console.error('DB Error on result:', dbErr);
                }
              }

            } catch (e) {
              // Ignore parse errors (e.g. non-JSON lines)
            }
          }
        });

        gemini.stderr.on('data', (data) => {
          console.error('Gemini stderr:', data.toString());
        });

        gemini.on('close', (code) => {
          if (code !== 0) {
            console.error('Gemini exited with code', code);
          }
          controller.close();
        });

        gemini.on('error', (err) => {
          controller.error(err);
        });
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
