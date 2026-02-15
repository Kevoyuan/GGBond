import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CoreService } from '@/lib/core-service';
import { getGeminiEnv } from '@/lib/gemini-utils';

type JsonRecord = Record<string, unknown>;

type McpAction =
  | { action: 'restart'; name?: string }
  | { action: 'add'; name: string; config: JsonRecord }
  | { action: 'details'; name: string };

const resolveSettingsPath = async () => {
  const env = getGeminiEnv();
  const configuredHome = env.GEMINI_CLI_HOME || process.env.GEMINI_CLI_HOME || '';
  if (configuredHome) {
    process.env.GEMINI_CLI_HOME = configuredHome;
  }

  const candidates = [
    configuredHome ? path.join(configuredHome, '.gemini', 'settings.json') : '',
    configuredHome ? path.join(configuredHome, 'settings.json') : '',
    path.join(process.env.HOME || '', '.gemini', 'settings.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to next candidate.
    }
  }

  // Default write target.
  return candidates[0];
};

const readSettings = async (): Promise<JsonRecord> => {
  const settingsPath = await resolveSettingsPath();
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as JsonRecord;
  } catch {
    return {};
  }
};

const writeSettings = async (settings: JsonRecord) => {
  const settingsPath = await resolveSettingsPath();
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
};

const normalizeServerConfig = (rawConfig: JsonRecord): JsonRecord => {
  const config: JsonRecord = {};
  const type = typeof rawConfig.type === 'string' ? rawConfig.type : undefined;

  if (typeof rawConfig.command === 'string' && rawConfig.command.trim()) {
    config.command = rawConfig.command.trim();
  }
  if (Array.isArray(rawConfig.args)) {
    config.args = rawConfig.args.map((item) => String(item));
  }
  if (typeof rawConfig.url === 'string' && rawConfig.url.trim()) {
    config.url = rawConfig.url.trim();
  }
  if (typeof rawConfig.httpUrl === 'string' && rawConfig.httpUrl.trim()) {
    config.httpUrl = rawConfig.httpUrl.trim();
  }
  if (type === 'http' || type === 'sse') {
    config.type = type;
  }
  if (typeof rawConfig.description === 'string' && rawConfig.description.trim()) {
    config.description = rawConfig.description.trim();
  }
  if (typeof rawConfig.cwd === 'string' && rawConfig.cwd.trim()) {
    config.cwd = rawConfig.cwd.trim();
  }

  return config;
};

const mapSettingsServers = (settings: JsonRecord) => {
  const settingsServers = ((settings.mcpServers ?? {}) as Record<string, JsonRecord>) || {};
  const mapped: Record<string, JsonRecord> = {};

  for (const [name, config] of Object.entries(settingsServers)) {
    mapped[name] = {
      ...config,
      status: 'disconnected',
      kind: config.command
        ? 'stdio'
        : ((config.type === 'http' || config.httpUrl) ? 'http' : 'sse'),
    };
  }

  return mapped;
};

export async function GET() {
  try {
    const core = CoreService.getInstance();
    const runtime = core.getMcpServersWithStatus();
    const settings = await readSettings();
    const mergedServers = {
      ...mapSettingsServers(settings),
      ...runtime.servers,
    };

    return NextResponse.json({
      discoveryState: runtime.discoveryState,
      servers: mergedServers,
    });
  } catch (error) {
    console.error('Error fetching MCP servers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as McpAction;
    const core = CoreService.getInstance();

    if (body.action === 'restart') {
      try {
        const name = (body.name || '').trim();

        // Read settings to get server config
        const settings = await readSettings();
        const mcpServers = ((settings.mcpServers ?? {}) as Record<string, JsonRecord>) || {};

        if (name && name.trim()) {
          // Get the server config from settings
          const serverConfig = mcpServers[name];
          if (serverConfig) {
            // Manually register the server config with the manager before restarting
            const coreInstance = CoreService.getInstance();
            const config = (coreInstance as any).config;
            const manager = config?.getMcpClientManager?.();
            if (manager) {
              const allServerConfigs = (manager as any).allServerConfigs;
              if (allServerConfigs) {
                allServerConfigs.set(name, normalizeServerConfig(serverConfig));
              }
            }
          }
          await core.restartMcpServer(name);
        } else {
          await core.restartAllMcpServers();
        }
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('[mcp] Restart error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
      }
    }

    if (body.action === 'details') {
      const name = (body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
      }

      const runtime = core.getMcpServersWithStatus();
      const server = runtime.servers[name];
      if (!server) {
        const settings = await readSettings();
        const fromSettings = ((settings.mcpServers as Record<string, JsonRecord> | undefined) ?? {})[name];
        if (!fromSettings) {
          return NextResponse.json({ error: `MCP server "${name}" not found` }, { status: 404 });
        }
        return NextResponse.json({ server: fromSettings });
      }
      return NextResponse.json({ server });
    }

    if (body.action === 'add') {
      const name = (body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
      }

      const normalizedConfig = normalizeServerConfig((body.config ?? {}) as JsonRecord);
      if (!normalizedConfig.command && !normalizedConfig.url && !normalizedConfig.httpUrl) {
        return NextResponse.json({
          error: 'Server config must include command (stdio) or url/httpUrl (network transport)',
        }, { status: 400 });
      }

      const settings = await readSettings();
      const existingServers = ((settings.mcpServers as Record<string, JsonRecord> | undefined) ?? {});
      settings.mcpServers = {
        ...existingServers,
        [name]: normalizedConfig,
      };
      await writeSettings(settings);

      try {
        await core.addMcpServer(name, normalizedConfig);
      } catch (error) {
        // Persisted successfully; runtime refresh can happen after next initialize.
        console.warn(`[mcp] Runtime add skipped for "${name}":`, error);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported MCP action' }, { status: 400 });
  } catch (error) {
    console.error('Error handling MCP operation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
