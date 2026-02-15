import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { Storage } from '@google/gemini-cli-core';
import { CoreService } from '@/lib/core-service';

interface CreateAgentRequest {
  name: string;
  displayName?: string;
  description: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTurns?: number;
  timeoutMins?: number;
  tools?: string[];
}

export async function POST(request: Request) {
  try {
    const body: CreateAgentRequest = await request.json();
    const { name, displayName, description, systemPrompt, model, temperature, maxTurns, timeoutMins, tools } = body;

    // 1. Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // 2. Sanitize name (lowercase, hyphens only)
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    if (!sanitizedName || sanitizedName.length < 2) {
      return NextResponse.json(
        { error: 'Invalid agent name. Use at least 2 alphanumeric characters.' },
        { status: 400 }
      );
    }

    // 3. Get agents directory
    const agentsDir = Storage.getUserAgentsDir();

    // 4. Ensure directory exists
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    // 5. Check if agent already exists
    const filePath = path.join(agentsDir, `${sanitizedName}.md`);
    if (fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Agent "${sanitizedName}" already exists` },
        { status: 409 }
      );
    }

    // 6. Build frontmatter
    const frontmatter: Record<string, unknown> = {
      name: sanitizedName,
      description,
      kind: 'local',
    };

    if (displayName) {
      frontmatter.display_name = displayName;
    }

    if (model) {
      frontmatter.model = model;
    }

    if (temperature !== undefined) {
      frontmatter.temperature = temperature;
    }

    if (maxTurns !== undefined) {
      frontmatter.max_turns = maxTurns;
    }

    if (timeoutMins !== undefined) {
      frontmatter.timeout_mins = timeoutMins;
    } else {
      frontmatter.timeout_mins = 5;
    }

    if (tools && tools.length > 0) {
      frontmatter.tools = tools;
    }

    // 7. Format frontmatter as YAML
    const frontmatterYaml = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(t => `  - ${t}`).join('\n')}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    // 8. Build file content
    const fileContent = `---
${frontmatterYaml}
---

${systemPrompt || 'You are a helpful AI assistant.'}
`;

    // 9. Write file
    fs.writeFileSync(filePath, fileContent, 'utf-8');

    // 10. Reload agent registry to pick up the new agent
    try {
      const core = CoreService.getInstance();
      if (core.config) {
        await core.config.getAgentRegistry().reload();
      }
    } catch (e) {
      // Agent might not be initialized yet, that's okay
      console.warn('[agents/create] Failed to reload agent registry:', e);
    }

    return NextResponse.json({
      success: true,
      agent: {
        name: sanitizedName,
        displayName: displayName || name,
        description,
        kind: 'local',
      },
      path: filePath,
    });
  } catch (error) {
    console.error('[agents/create] Error creating agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 500 }
    );
  }
}
