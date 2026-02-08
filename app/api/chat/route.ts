import { NextResponse } from 'next/server';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { prompt, model, systemInstruction } = await req.json();

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
        if (code !== 0) {
          console.error('Gemini stderr:', stderr);
          // Try to parse JSON from stdout even if error code
          try {
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
              const data = JSON.parse(jsonStr);
              resolve(NextResponse.json(data));
              return;
            }
          } catch {
            // ignore
          }
          resolve(NextResponse.json({ error: stderr || 'Gemini CLI failed', details: stdout }, { status: 500 }));
        } else {
          try {
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
              const data = JSON.parse(jsonStr);
              resolve(NextResponse.json(data));
            } else {
              resolve(NextResponse.json({ content: stdout }));
            }
          } catch (e) {
            console.error('Failed to parse JSON:', e);
            resolve(NextResponse.json({ content: stdout, raw: true }));
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
