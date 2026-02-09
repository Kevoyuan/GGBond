import { NextResponse } from 'next/server';
import { runGeminiCommand } from '@/lib/gemini-utils';
import { ProjectContext } from '@/lib/types/gemini';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await runGeminiCommand('/directory show') as any;
    
    // Default structure
    const context: ProjectContext = {
      workingDirectory: process.cwd(),
      includedDirectories: [],
      memoryFiles: [],
      totalIndexedFiles: 0,
      contextSize: '0B'
    };

    if (data && typeof data === 'object') {
        if (data.workingDirectory) context.workingDirectory = data.workingDirectory;
        if (Array.isArray(data.includedDirectories)) context.includedDirectories = data.includedDirectories;
        if (Array.isArray(data.memoryFiles)) context.memoryFiles = data.memoryFiles;
        if (data.totalIndexedFiles) context.totalIndexedFiles = data.totalIndexedFiles;
        if (data.contextSize) context.contextSize = data.contextSize;
    }

    return NextResponse.json(context);
  } catch (error) {
    console.error('Failed to fetch context:', error);
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, path } = await req.json();

    if (!action || !path) {
      return NextResponse.json({ error: 'Action and path are required' }, { status: 400 });
    }

    let command = '';
    
    switch (action) {
      case 'add':
        command = `/directory add ${path}`;
        break;
      case 'remove':
        command = `/directory remove ${path}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await runGeminiCommand(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update context:', error);
    return NextResponse.json({ error: 'Failed to update context' }, { status: 500 });
  }
}
