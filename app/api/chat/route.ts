import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import db from '@/lib/db';
import { getGeminiPath, getGeminiEnv } from '@/lib/gemini-utils';

export async function POST(req: Request) {
  try {
    const { prompt, model, systemInstruction, sessionId, workspace, modelSettings } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

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

    // Add prompt (prepend system instruction if present)
    let fullPrompt = prompt;
    if (systemInstruction) {
      fullPrompt = `System Instruction: ${systemInstruction}\n\nUser Request: ${prompt}`;
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
    let userMessageSaved = false;

    const stream = new ReadableStream({
      start(controller) {
        const gemini = spawn(process.execPath, args, { env });
        
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
                      db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
                        detectedSessionId,
                        'user',
                        prompt,
                        now
                      );
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
                     db.prepare('INSERT INTO messages (session_id, role, content, stats, created_at) VALUES (?, ?, ?, ?, ?)').run(
                      detectedSessionId,
                      'model',
                      fullResponseContent,
                      finalStats ? JSON.stringify(finalStats) : null,
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
