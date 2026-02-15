import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google/gemini-cli-core';
import { CoreService } from '@/lib/core-service';

interface DeleteAgentRequest {
  name: string;
}

export async function POST(request: Request) {
  try {
    const body: DeleteAgentRequest = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    // Only allow deleting user agents (not built-in)
    const agentsDir = Storage.getUserAgentsDir();
    const filePath = path.join(agentsDir, `${name}.md`);

    // Check if it's a user agent
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Agent "${name}" not found in user agents` },
        { status: 404 }
      );
    }

    // Delete the agent file
    fs.unlinkSync(filePath);

    // Reload agent registry
    try {
      const core = CoreService.getInstance();
      if (core.config) {
        await core.config.getAgentRegistry().reload();
      }
    } catch (e) {
      console.warn('[agents/delete] Failed to reload agent registry:', e);
    }

    return NextResponse.json({
      success: true,
      name,
    });
  } catch (error) {
    console.error('[agents/delete] Error deleting agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
