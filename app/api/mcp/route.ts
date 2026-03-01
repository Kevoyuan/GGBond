import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CoreService } from '@/lib/core-service';
import { getMcpSecurityConfig } from '@/lib/config-service';
import { resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';

type JsonRecord = Record<string, unknown>;

type McpAction =
  | { action: 'restart'; name?: string }
  | { action: 'add'; name: string; config: JsonRecord }
  | { action: 'delete'; name: string }
  | { action: 'details'; name: string }
  | { action: 'installExtension'; name: string; repoUrl: string };

const MCP_SETTINGS_CACHE_TTL_MS = 3000;
let mcpSettingsCache: { data: JsonRecord; expiresAt: number } | null = null;
let mcpSettingsInFlight: Promise<JsonRecord> | null = null;

const resolveSettingsPath = async () => {
  const runtimeHome = resolveRuntimeHome();
  const configuredDir = resolveGeminiConfigDir(runtimeHome);
  const candidates = [path.join(configuredDir, 'settings.json')];

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
  const now = Date.now();
  if (mcpSettingsCache && mcpSettingsCache.expiresAt > now) {
    return mcpSettingsCache.data;
  }
  if (mcpSettingsInFlight) {
    return mcpSettingsInFlight;
  }

  mcpSettingsInFlight = (async () => {
  const settingsPath = await resolveSettingsPath();
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const parsed = JSON.parse(content) as JsonRecord;
      mcpSettingsCache = { data: parsed, expiresAt: Date.now() + MCP_SETTINGS_CACHE_TTL_MS };
      return parsed;
    } catch {
      mcpSettingsCache = { data: {}, expiresAt: Date.now() + MCP_SETTINGS_CACHE_TTL_MS };
      return {};
    } finally {
      mcpSettingsInFlight = null;
    }
  })();
  return mcpSettingsInFlight;
};

const writeSettings = async (settings: JsonRecord) => {
  const settingsPath = await resolveSettingsPath();
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  mcpSettingsCache = { data: settings, expiresAt: Date.now() + MCP_SETTINGS_CACHE_TTL_MS };
  mcpSettingsInFlight = null;
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

const compileRegexList = (patterns: string[]) => {
  return patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch (error) {
        console.warn('[mcp] Invalid MCP security regex pattern:', pattern, error);
        return null;
      }
    })
    .filter((item): item is RegExp => Boolean(item));
};

const isMcpAddAllowed = async (name: string, config: JsonRecord) => {
  const security = await getMcpSecurityConfig();
  if (!security.enabled) return { allowed: true };

  if (security.allowedServerNames.length > 0 && !security.allowedServerNames.includes(name)) {
    return { allowed: false, reason: `MCP server "${name}" is not in allowlist` };
  }

  const commandString = `${typeof config.command === 'string' ? config.command : ''} ${Array.isArray(config.args) ? config.args.join(' ') : ''}`.trim();
  const blockedRegex = compileRegexList(security.blockedCommandRegex);
  if (commandString && blockedRegex.some((regex) => regex.test(commandString))) {
    return { allowed: false, reason: 'MCP command matched blocked pattern' };
  }

  const allowedRegex = compileRegexList(security.allowedCommandRegex);
  if (allowedRegex.length > 0 && commandString && !allowedRegex.some((regex) => regex.test(commandString))) {
    return { allowed: false, reason: 'MCP command does not match any allowed pattern' };
  }

  return { allowed: true };
};

const isExtensionInstallAllowed = async (name: string, repoUrl: string) => {
  const security = await getMcpSecurityConfig();
  if (!security.enabled) return { allowed: true };

  if (security.allowedServerNames.length > 0 && !security.allowedServerNames.includes(name)) {
    return { allowed: false, reason: `Extension "${name}" is not in allowlist` };
  }

  const allowedRepoRegex = compileRegexList(security.allowedRepoPatterns);
  if (allowedRepoRegex.length > 0 && !allowedRepoRegex.some((regex) => regex.test(repoUrl))) {
    return { allowed: false, reason: 'Repository URL is not allowlisted' };
  }

  return { allowed: true };
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
        const security = await getMcpSecurityConfig();
        if (security.enabled && name && security.allowedServerNames.length > 0 && !security.allowedServerNames.includes(name)) {
          return NextResponse.json({ error: `MCP server "${name}" is not in allowlist` }, { status: 403 });
        }

        // Read settings to get server config
        const settings = await readSettings();
        const mcpServers = ((settings.mcpServers ?? {}) as Record<string, JsonRecord>) || {};

        if (name && name.trim()) {
          // Get the server config from settings
          const serverConfig = mcpServers[name];
          if (serverConfig) {
            // Manually register the server config with the manager before restarting
            const coreInstance = CoreService.getInstance();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const config = (coreInstance as any).config;
            const manager = config?.getMcpClientManager?.();
            if (manager) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const allowResult = await isMcpAddAllowed(name, normalizedConfig);
      if (!allowResult.allowed) {
        return NextResponse.json({ error: allowResult.reason || 'MCP server blocked by allowlist' }, { status: 403 });
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

    if (body.action === 'delete') {
      const name = (body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
      }

      const settings = await readSettings();
      const mcpServers = ((settings.mcpServers as Record<string, JsonRecord> | undefined) ?? {});

      if (!mcpServers[name]) {
        return NextResponse.json({ error: `MCP server "${name}" not found in settings` }, { status: 404 });
      }

      // Remove the server from settings
      const { [name]: removed, ...remainingServers } = mcpServers;
      settings.mcpServers = remainingServers;
      await writeSettings(settings);

      // Try to stop the server in runtime if possible
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coreAny = core as any;
        if (typeof coreAny.removeMcpServer === 'function') {
          await coreAny.removeMcpServer(name);
        }
      } catch (error) {
        console.warn(`[mcp] Runtime remove skipped for "${name}":`, error);
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === 'installExtension') {
      const name = (body.name || '').trim();
      const repoUrl = (body.repoUrl || '').trim();

      if (!name) {
        return NextResponse.json({ error: 'Extension name is required' }, { status: 400 });
      }

      if (!repoUrl) {
        return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
      }
      const allowResult = await isExtensionInstallAllowed(name, repoUrl);
      if (!allowResult.allowed) {
        return NextResponse.json({ error: allowResult.reason || 'Extension blocked by allowlist' }, { status: 403 });
      }

      try {
        // Use child_process to run the gemini CLI command
        const { spawn } = await import('node:child_process');

        return new Promise<Response>((resolve) => {
          const installProcess = spawn('gemini', ['extensions', 'install', repoUrl], {
            stdio: 'pipe',
            shell: true,
          });

          let output = '';
          let errorOutput = '';

          installProcess.stdout?.on('data', (data) => {
            output += data.toString();
          });

          installProcess.stderr?.on('data', (data) => {
            errorOutput += data.toString();
          });

          installProcess.on('close', (code) => {
            if (code === 0) {
              resolve(NextResponse.json({ success: true, output }));
            } else {
              console.error('[mcp] Extension install error:', errorOutput);
              resolve(NextResponse.json(
                { error: errorOutput || 'Failed to install extension' },
                { status: 500 }
              ));
            }
          });

          installProcess.on('error', (err) => {
            console.error('[mcp] Extension install process error:', err);
            resolve(NextResponse.json(
              { error: 'Failed to start installation process' },
              { status: 500 }
            ));
          });
        });
      } catch (error) {
        console.error('[mcp] Extension install error:', error);
        return NextResponse.json(
          { error: 'Failed to install extension: ' + String(error) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Unsupported MCP action' }, { status: 400 });
  } catch (error) {
    console.error('Error handling MCP operation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
