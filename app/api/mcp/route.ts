import { NextResponse } from 'next/server';
import { readSettingsJson, writeSettingsJson } from '@/lib/settings';

// Mock data or read from settings
export async function GET() {
  try {
    const settings = await readSettingsJson();
    // Assuming mcpServers is stored in settings.json under 'mcpServers'
    const mcpServers = settings.mcpServers || {};
    return NextResponse.json(mcpServers);
  } catch (error) {
    console.error('Failed to fetch MCP servers:', error);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action, serverName, config } = await req.json();
    const settings = await readSettingsJson();
    settings.mcpServers = settings.mcpServers || {};

    if (action === 'add' || action === 'update') {
      if (!serverName) return NextResponse.json({ error: 'Server name required' }, { status: 400 });
      settings.mcpServers[serverName] = { ...settings.mcpServers[serverName], ...config };
    } else if (action === 'remove') {
      if (!serverName) return NextResponse.json({ error: 'Server name required' }, { status: 400 });
      delete settings.mcpServers[serverName];
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await writeSettingsJson(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update MCP servers:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
