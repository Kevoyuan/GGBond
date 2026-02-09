import { NextResponse } from 'next/server';
import { runGeminiCommand } from '@/lib/gemini-utils';
import { Checkpoint } from '@/lib/types/gemini';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await runGeminiCommand('/chat list') as any;
    
    // Transform CLI output to Checkpoint[]
    let checkpoints: Checkpoint[] = [];
    
    if (Array.isArray(data)) {
        checkpoints = data;
    } else if (data.checkpoints && Array.isArray(data.checkpoints)) {
        checkpoints = data.checkpoints;
    } else if (typeof data.content === 'string') {
        try {
             const parsed = JSON.parse(data.content);
             if (Array.isArray(parsed)) checkpoints = parsed;
        } catch {
            // If parsing fails, return empty or try to parse text
        }
    }

    return NextResponse.json(checkpoints);
  } catch (error) {
    console.error('Failed to fetch timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let action = 'unknown';
  try {
    const body = await req.json();
    action = body.action;
    const { tag } = body;
    
    if (!tag) {
      return NextResponse.json({ error: 'Tag is required' }, { status: 400 });
    }

    let command = '';
    switch (action) {
      case 'restore':
        command = `/chat resume ${tag}`;
        break;
      case 'delete':
        command = `/chat delete ${tag}`;
        break;
      case 'save':
        command = `/chat save ${tag}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await runGeminiCommand(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to ${action} checkpoint:`, error);
    return NextResponse.json({ error: `Failed to ${action} checkpoint` }, { status: 500 });
  }
}
