import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { addMessage, createSession, getSession } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Handle session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = uuidv4();
      createSession(currentSessionId, prompt.slice(0, 30) + '...');
    } else {
      const exists = getSession(currentSessionId);
      if (!exists) {
        createSession(currentSessionId, prompt.slice(0, 30) + '...');
      }
    }

    // Save user message
    addMessage(currentSessionId, 'user', prompt);

    // Resolve gemini executable path
    let geminiScriptPath = '';
    try {
      const geminiBin = execSync('which gemini').toString().trim();
      // It's likely a symlink to the JS file
      geminiScriptPath = fs.realpathSync(geminiBin);
    } catch (e) {
      console.error('Failed to find gemini executable:', e);
      return NextResponse.json({ error: 'Gemini CLI not found' }, { status: 500 });
    }

    const args = [geminiScriptPath, '-p', prompt, '--output-format', 'json'];
    
    // Set HOME to local gemini-home to isolate config and history
    const localHome = path.join(process.cwd(), 'gemini-home');
    
    console.log('Running gemini with HOME:', localHome);
    console.log('Script path:', geminiScriptPath);

    return new Promise((resolve) => {
      // Spawn 'node' directly with the script
      const gemini = spawn('node', args, {
        env: { 
          ...process.env, 
          HOME: localHome, 
          TERM: 'dumb',
          GEMINI_FORCE_FILE_STORAGE: 'true' // Disable keychain usage to prevent popups
        }
      });
      
      let stdout = '';
      let stderr = '';

      gemini.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gemini.stderr.on('data', (data) => {
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
              
              // Save model response
              const content = data.response || data.content || JSON.stringify(data);
              addMessage(currentSessionId, 'model', content, data.stats);
              
              resolve(NextResponse.json({ ...data, sessionId: currentSessionId }));
              return;
            }
          } catch (e) {
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
              
              // Save model response
              const content = data.response || data.content || (typeof data === 'string' ? data : JSON.stringify(data));
              addMessage(currentSessionId, 'model', content, data.stats);

              resolve(NextResponse.json({ ...data, sessionId: currentSessionId }));
            } else {
              const content = stdout;
              addMessage(currentSessionId, 'model', content);
              resolve(NextResponse.json({ content, sessionId: currentSessionId }));
            }
          } catch (e) {
            console.error('Failed to parse JSON:', e);
            addMessage(currentSessionId, 'model', stdout, { raw: true });
            resolve(NextResponse.json({ content: stdout, raw: true, sessionId: currentSessionId }));
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
