import { NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { prompt, model, systemInstruction, sessionId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Resolve gemini executable path
    let geminiScriptPath = '';
    try {
      const geminiBin = execSync('which gemini').toString().trim();
      geminiScriptPath = fs.realpathSync(geminiBin);
    } catch {
      console.error('Failed to find gemini executable');
      return NextResponse.json({ error: 'Gemini CLI not found' }, { status: 500 });
    }

    // Construct arguments
    const args = [geminiScriptPath, '--output-format', 'json'];
    
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

    // Set HOME to local gemini-home to isolate config and history
    const localHome = path.join(process.cwd(), 'gemini-home');
    
    console.log('Running gemini with HOME:', localHome);
    console.log('Script path:', geminiScriptPath);

    return new Promise<NextResponse>((resolve) => {
      // Spawn 'node' directly with the script
      const gemini = spawn(process.execPath, args, {
        env: { 
          ...process.env, 
          HOME: localHome, 
          TERM: 'dumb',
          GEMINI_FORCE_FILE_STORAGE: 'true' // Disable keychain usage to prevent popups
        }
      });
      
      let stdout = '';
      let stderr = '';

      gemini.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      gemini.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      gemini.on('close', (code) => {
        console.log('Gemini exited with code:', code);
        
        let responseData: any = null;
        let finalSessionId = sessionId;

        // Try to parse JSON output
        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
            responseData = JSON.parse(jsonStr);
            if (responseData.session_id) {
              finalSessionId = responseData.session_id;
            }
          }
        } catch (e) {
          console.error('Failed to parse JSON:', e);
        }

        // If we have a session ID (either from request or response), save to DB
        if (finalSessionId) {
          try {
            const now = Date.now();
            
            // Check if session exists
            const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(finalSessionId);
            
            if (!existingSession) {
              // Create new session
              // Use first 50 chars of prompt as title
              const title = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
              db.prepare('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
                finalSessionId,
                title,
                now,
                now
              );
            } else {
              // Update timestamp
              db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, finalSessionId);
            }

            // Insert User Message
            db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
              finalSessionId,
              'user',
              prompt,
              now
            );

            // Insert Model Response
            if (responseData) {
              const content = responseData.response || responseData.content || JSON.stringify(responseData);
              const stats = responseData.stats ? JSON.stringify(responseData.stats) : null;
              
              db.prepare('INSERT INTO messages (session_id, role, content, stats, created_at) VALUES (?, ?, ?, ?, ?)').run(
                finalSessionId,
                'model',
                content,
                stats,
                now + 1 // Ensure slightly later timestamp
              );
            } else if (code !== 0) {
                // If failed and no JSON, maybe save error?
                // For now, let's not pollute history with errors unless we have a clear session
            }

          } catch (dbError) {
            console.error('Database error:', dbError);
            // Don't fail the request if DB fails, but log it
          }
        }

        if (code !== 0) {
          console.error('Gemini stderr:', stderr);
          resolve(NextResponse.json({ 
            error: stderr || 'Gemini CLI failed', 
            details: stdout,
            session_id: finalSessionId 
          }, { status: 500 }));
        } else {
           if (responseData) {
             resolve(NextResponse.json(responseData));
           } else {
             resolve(NextResponse.json({ content: stdout, session_id: finalSessionId }));
           }
        }
      });
      
      gemini.on('error', (err) => {
        console.error('Spawn error:', err);
        resolve(NextResponse.json({ error: 'Failed to spawn gemini process' }, { status: 500 }));
      });
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
