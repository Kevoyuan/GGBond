import { NextResponse } from '@/src-sidecar/mock-next-server';
import db from '@/lib/db';
import { getAuthInfo, parseTelemetryLog, type TelemetryEvent } from '@/lib/gemini-service';
import { normalizeTokenStats, type PerModelTokenUsage } from '@/lib/token-stats';

type SessionRow = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

type MessageStatsRow = {
  role: string;
  stats: string | null;
  created_at: number;
  updated_at: number | null;
};

type ToolStatRow = {
  tool_name: string;
  session_id: string | null;
  status: string;
  duration_ms: number | null;
  created_at: number;
};

type BackgroundJobRow = {
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  status: string;
};

type TokenTotals = {
  input: number;
  output: number;
  cached: number;
  thoughts: number;
  total: number;
};

type RoleStat = TokenTotals & {
  role: string;
  requests: number;
};

type ModelStat = TokenTotals & {
  model: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
  roles: RoleStat[];
};

type ToolDecisionSummary = {
  reviewed: number;
  accepted: number;
  autoAccepted: number;
  rejected: number;
  modified: number;
  agreementRate: number | null;
};

type SessionModelStat = {
  model: string;
  requests: number;
  totalTokens: number;
};

type SessionStats = {
  id: string;
  title: string;
  resolvedFrom: 'requested' | 'latest';
  toolCalls: number;
  successRate: number | null;
  wallTimeMs: number;
  agentActiveMs: number;
  apiTimeMs: number;
  toolTimeMs: number;
  userAgreement: ToolDecisionSummary;
  models: SessionModelStat[];
};

type ToolRow = {
  toolName: string;
  success: number;
  failed: number;
  total: number;
  successRate: number;
  avgDurationMs: number;
};

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function emptyTokens(): TokenTotals {
  return {
    input: 0,
    output: 0,
    cached: 0,
    thoughts: 0,
    total: 0,
  };
}

function parseMessageStatsByModel(raw: string | null): Array<TokenTotals & { model: string; durationMs: number }> {
  if (!raw) return [];
  try {
    const parsed = normalizeTokenStats(JSON.parse(raw));
    if (!parsed) return [];

    const modelEntries = parsed.perModelUsage.length > 0
      ? parsed.perModelUsage
      : [{
        model: parsed.model,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        cachedTokens: parsed.cachedTokens,
        thoughtsTokens: parsed.thoughtsTokens,
        totalTokens: parsed.totalTokens,
      }];

    return modelEntries.map((entry: PerModelTokenUsage) => ({
      model: entry.model,
      input: entry.inputTokens,
      output: entry.outputTokens,
      cached: entry.cachedTokens,
      thoughts: entry.thoughtsTokens,
      total: entry.totalTokens,
      durationMs: parsed.durationMs,
    }));
  } catch {
    return [];
  }
}

function getFriendlyAuthLabel(authType: string): string {
  const normalized = authType.toLowerCase();
  if (normalized.includes('oauth') || normalized.includes('personal')) return 'Logged in with Google';
  if (normalized.includes('google')) return 'Logged in with Google';
  if (normalized.includes('vertex')) return 'Vertex AI';
  if (normalized.includes('gemini') || normalized.includes('api')) return 'Gemini API Key';
  return authType || 'Unknown';
}

function getEventTimeMs(event: TelemetryEvent): number {
  const startTime = readNumber(event.attributes.start_time);
  const endTime = readNumber(event.attributes.end_time);
  if (endTime > 0) return endTime;
  if (startTime > 0) return startTime;
  return normalizeTimestamp(event.timestamp);
}

function buildDecisionSummary(events: TelemetryEvent[]): ToolDecisionSummary {
  let accepted = 0;
  let autoAccepted = 0;
  let rejected = 0;
  let modified = 0;

  for (const event of events) {
    const decision = typeof event.attributes.decision === 'string' ? event.attributes.decision : '';
    switch (decision) {
      case 'accept':
        accepted += 1;
        break;
      case 'auto_accept':
        autoAccepted += 1;
        break;
      case 'reject':
        rejected += 1;
        break;
      case 'modify':
        modified += 1;
        break;
      default:
        break;
    }
  }

  const reviewed = accepted + autoAccepted + rejected + modified;
  return {
    reviewed,
    accepted,
    autoAccepted,
    rejected,
    modified,
    agreementRate: reviewed > 0 ? ((accepted + autoAccepted) / reviewed) * 100 : null,
  };
}

function buildToolRows(toolStats: ToolStatRow[]): ToolRow[] {
  const toolMap = new Map<string, { success: number; failed: number; total: number; durationSum: number; durationCount: number }>();

  for (const stat of toolStats) {
    const current = toolMap.get(stat.tool_name) || {
      success: 0,
      failed: 0,
      total: 0,
      durationSum: 0,
      durationCount: 0,
    };

    current.total += 1;
    if (stat.status === 'success') {
      current.success += 1;
    } else {
      current.failed += 1;
    }

    if (typeof stat.duration_ms === 'number' && Number.isFinite(stat.duration_ms) && stat.duration_ms > 0) {
      current.durationSum += stat.duration_ms;
      current.durationCount += 1;
    }

    toolMap.set(stat.tool_name, current);
  }

  return Array.from(toolMap.entries())
    .map(([toolName, value]) => ({
      toolName,
      success: value.success,
      failed: value.failed,
      total: value.total,
      successRate: value.total > 0 ? (value.success / value.total) * 100 : 0,
      avgDurationMs: value.durationCount > 0 ? Math.round(value.durationSum / value.durationCount) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.toolName.localeCompare(b.toolName));
}

function buildModelStatsFromTelemetry(events: TelemetryEvent[]): ModelStat[] {
  const apiResponses = events.filter((event) => event.name === 'gemini_cli.api_response');
  const apiErrors = events.filter((event) => event.name === 'gemini_cli.api_error');
  const modelMap = new Map<string, ModelStat & { latencySum: number; latencyCount: number; roleMap: Map<string, RoleStat> }>();

  for (const event of apiResponses) {
    const model = typeof event.attributes.model === 'string' ? event.attributes.model : 'unknown';
    const existing = modelMap.get(model) || {
      model,
      requests: 0,
      errors: 0,
      avgLatencyMs: 0,
      ...emptyTokens(),
      roles: [],
      latencySum: 0,
      latencyCount: 0,
      roleMap: new Map<string, RoleStat>(),
    };

    const input = readNumber(event.attributes.input_token_count);
    const output = readNumber(event.attributes.output_token_count);
    const cached = readNumber(event.attributes.cached_content_token_count);
    const thoughts = readNumber(event.attributes.thoughts_token_count);
    const total = readNumber(event.attributes.total_token_count) || input + output + cached + thoughts;
    const durationMs = readNumber(event.attributes.duration_ms);
    const role = typeof event.attributes.role === 'string' ? event.attributes.role : 'main';

    existing.requests += 1;
    existing.input += input;
    existing.output += output;
    existing.cached += cached;
    existing.thoughts += thoughts;
    existing.total += total;
    if (durationMs > 0) {
      existing.latencySum += durationMs;
      existing.latencyCount += 1;
    }

    const roleStat = existing.roleMap.get(role) || {
      role,
      requests: 0,
      ...emptyTokens(),
    };
    roleStat.requests += 1;
    roleStat.input += input;
    roleStat.output += output;
    roleStat.cached += cached;
    roleStat.thoughts += thoughts;
    roleStat.total += total;
    existing.roleMap.set(role, roleStat);

    modelMap.set(model, existing);
  }

  for (const event of apiErrors) {
    const model = typeof event.attributes.model === 'string' ? event.attributes.model : 'unknown';
    const existing = modelMap.get(model) || {
      model,
      requests: 0,
      errors: 0,
      avgLatencyMs: 0,
      ...emptyTokens(),
      roles: [],
      latencySum: 0,
      latencyCount: 0,
      roleMap: new Map<string, RoleStat>(),
    };
    existing.errors += 1;
    modelMap.set(model, existing);
  }

  return Array.from(modelMap.values())
    .map((stat) => ({
      model: stat.model,
      requests: stat.requests,
      errors: stat.errors,
      avgLatencyMs: stat.latencyCount > 0 ? Math.round(stat.latencySum / stat.latencyCount) : 0,
      input: stat.input,
      output: stat.output,
      cached: stat.cached,
      thoughts: stat.thoughts,
      total: stat.total,
      roles: Array.from(stat.roleMap.values()).sort((a, b) => b.requests - a.requests || a.role.localeCompare(b.role)),
    }))
    .sort((a, b) => b.requests - a.requests || b.total - a.total || a.model.localeCompare(b.model));
}

function buildModelStatsFromDb(rows: MessageStatsRow[]): ModelStat[] {
  const modelMap = new Map<string, ModelStat & { latencySum: number; latencyCount: number }>();

  for (const row of rows) {
    const parsedEntries = parseMessageStatsByModel(row.stats);
    if (parsedEntries.length === 0) continue;

    for (const parsed of parsedEntries) {
      const existing = modelMap.get(parsed.model) || {
        model: parsed.model,
        requests: 0,
        errors: 0,
        avgLatencyMs: 0,
        ...emptyTokens(),
        roles: [],
        latencySum: 0,
        latencyCount: 0,
      };

      existing.requests += 1;
      existing.input += parsed.input;
      existing.output += parsed.output;
      existing.cached += parsed.cached;
      existing.thoughts += parsed.thoughts;
      existing.total += parsed.total;
      if (parsed.durationMs > 0) {
        existing.latencySum += parsed.durationMs;
        existing.latencyCount += 1;
      }

      modelMap.set(parsed.model, existing);
    }
  }

  return Array.from(modelMap.values())
    .map((stat) => ({
      model: stat.model,
      requests: stat.requests,
      errors: stat.errors,
      avgLatencyMs: stat.latencyCount > 0 ? Math.round(stat.latencySum / stat.latencyCount) : 0,
      input: stat.input,
      output: stat.output,
      cached: stat.cached,
      thoughts: stat.thoughts,
      total: stat.total,
      roles: stat.requests > 0
        ? [{
          role: 'main',
          requests: stat.requests,
          input: stat.input,
          output: stat.output,
          cached: stat.cached,
          thoughts: stat.thoughts,
          total: stat.total,
        }]
        : [],
    }))
    .sort((a, b) => b.requests - a.requests || b.total - a.total || a.model.localeCompare(b.model));
}

function getMessageEndTime(row: MessageStatsRow): number {
  return typeof row.updated_at === 'number' && Number.isFinite(row.updated_at) && row.updated_at > 0
    ? row.updated_at
    : row.created_at;
}

function getBackgroundJobEndTime(row: BackgroundJobRow): number {
  if (typeof row.completed_at === 'number' && Number.isFinite(row.completed_at) && row.completed_at > 0) {
    return row.completed_at;
  }
  return row.updated_at;
}

function buildSessionStats(
  session: SessionRow,
  toolStats: ToolStatRow[],
  decisionEvents: TelemetryEvent[],
  messageRows: MessageStatsRow[],
  backgroundJobs: BackgroundJobRow[],
  resolvedFrom: 'requested' | 'latest'
): SessionStats {
  const sessionModelMap = new Map<string, SessionModelStat>();
  let apiTimeMs = 0;
  let firstActivityAt = session.created_at;
  let lastActivityAt = session.updated_at;

  for (const row of messageRows) {
    firstActivityAt = Math.min(firstActivityAt, row.created_at);
    lastActivityAt = Math.max(lastActivityAt, getMessageEndTime(row));

    if (row.role !== 'model') {
      continue;
    }

    const parsedEntries = parseMessageStatsByModel(row.stats);
    if (parsedEntries.length === 0) continue;

    apiTimeMs += parsedEntries[0]?.durationMs || 0;

    for (const parsed of parsedEntries) {
      const existing = sessionModelMap.get(parsed.model) || {
        model: parsed.model,
        requests: 0,
        totalTokens: 0,
      };
      existing.requests += 1;
      existing.totalTokens += parsed.total;
      sessionModelMap.set(parsed.model, existing);
    }
  }

  let toolTimeMs = 0;
  let toolSuccess = 0;
  for (const tool of toolStats) {
    if (typeof tool.duration_ms === 'number' && Number.isFinite(tool.duration_ms) && tool.duration_ms > 0) {
      toolTimeMs += tool.duration_ms;
    }
    if (tool.status === 'success') {
      toolSuccess += 1;
    }
    firstActivityAt = Math.min(firstActivityAt, tool.created_at);
    lastActivityAt = Math.max(lastActivityAt, tool.created_at);
  }

  let backgroundJobActiveMs = 0;
  for (const job of backgroundJobs) {
    firstActivityAt = Math.min(firstActivityAt, job.created_at);
    lastActivityAt = Math.max(lastActivityAt, getBackgroundJobEndTime(job));
    backgroundJobActiveMs += Math.max(getBackgroundJobEndTime(job) - job.created_at, 0);
  }

  const wallTimeMs = Math.max(0, lastActivityAt - firstActivityAt);
  const userAgreement = buildDecisionSummary(decisionEvents);
  const fallbackActiveMs = backgroundJobActiveMs > 0 ? backgroundJobActiveMs : wallTimeMs;
  const computedActiveMs = apiTimeMs + toolTimeMs;
  const agentActiveMs = Math.max(computedActiveMs, fallbackActiveMs);
  const normalizedApiTimeMs = apiTimeMs > 0
    ? apiTimeMs
    : Math.max(agentActiveMs - toolTimeMs, 0);

  return {
    id: session.id,
    title: session.title,
    resolvedFrom,
    toolCalls: toolStats.length,
    successRate: toolStats.length > 0 ? (toolSuccess / toolStats.length) * 100 : null,
    wallTimeMs,
    agentActiveMs,
    apiTimeMs: normalizedApiTimeMs,
    toolTimeMs,
    userAgreement,
    models: Array.from(sessionModelMap.values()).sort((a, b) => b.requests - a.requests || b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedSessionId = searchParams.get('sessionId');

    const [authInfo, telemetryEvents] = await Promise.all([
      getAuthInfo(),
      parseTelemetryLog(5000),
    ]);

    const globalToolStats = db.prepare(`
      SELECT tool_name, session_id, status, duration_ms, created_at
      FROM tool_stats
      WHERE created_at >= strftime('%s', 'now', '-30 days') * 1000
      ORDER BY created_at DESC
    `).all() as ToolStatRow[];

    const telemetryToolEvents = telemetryEvents.filter((event) => event.name === 'gemini_cli.tool_call');
    const toolDecisionSummary = buildDecisionSummary(telemetryToolEvents);

    let sessionRow: SessionRow | undefined;
    let sessionResolvedFrom: 'requested' | 'latest' = 'latest';
    if (requestedSessionId && requestedSessionId.trim()) {
      sessionRow = db.prepare(`
        SELECT id, title, created_at, updated_at
        FROM sessions
        WHERE id = ?
      `).get(requestedSessionId.trim()) as SessionRow | undefined;
      sessionResolvedFrom = 'requested';
    }

    if (!sessionRow) {
      sessionRow = db.prepare(`
        SELECT id, title, created_at, updated_at
        FROM sessions
        ORDER BY updated_at DESC
        LIMIT 1
      `).get() as SessionRow | undefined;
      sessionResolvedFrom = 'latest';
    }

    const hasTelemetryModelData = telemetryEvents.some((event) => event.name === 'gemini_cli.api_response' || event.name === 'gemini_cli.api_error');
    const fallbackMessageRows = hasTelemetryModelData
      ? []
      : db.prepare(`
          SELECT role, stats, created_at, updated_at
          FROM messages
          WHERE role = 'model' AND stats IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 5000
        `).all() as MessageStatsRow[];

    const models = hasTelemetryModelData
      ? buildModelStatsFromTelemetry(telemetryEvents)
      : buildModelStatsFromDb(fallbackMessageRows);

    let session: SessionStats | null = null;
    if (sessionRow) {
      const sessionMessageRows = db.prepare(`
        SELECT role, stats, created_at, updated_at
        FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionRow.id) as MessageStatsRow[];

      const sessionToolStats = db.prepare(`
        SELECT tool_name, session_id, status, duration_ms, created_at
        FROM tool_stats
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionRow.id) as ToolStatRow[];
      const sessionBackgroundJobs = db.prepare(`
        SELECT created_at, updated_at, completed_at, status
        FROM background_jobs
        WHERE session_id = ?
        ORDER BY created_at ASC
      `).all(sessionRow.id) as BackgroundJobRow[];
      const sessionStart = sessionRow.created_at;
      const sessionEnd = Math.max(
        sessionRow.updated_at,
        sessionToolStats.reduce((max, row) => Math.max(max, row.created_at), 0),
        sessionMessageRows.reduce((max, row) => Math.max(max, getMessageEndTime(row)), 0),
        sessionBackgroundJobs.reduce((max, row) => Math.max(max, getBackgroundJobEndTime(row)), 0),
      );
      const sessionDecisionEvents = telemetryToolEvents.filter((event) => {
        const eventTimeMs = getEventTimeMs(event);
        return eventTimeMs >= sessionStart - 1000 && eventTimeMs <= sessionEnd + 1000;
      });

      session = buildSessionStats(
        sessionRow,
        sessionToolStats,
        sessionDecisionEvents,
        sessionMessageRows,
        sessionBackgroundJobs,
        sessionResolvedFrom,
      );
    }

    const accountEmail = authInfo.accounts?.[0]?.email || undefined;

    return NextResponse.json({
      meta: {
        authMethod: getFriendlyAuthLabel(authInfo.type),
        authType: authInfo.type || 'unknown',
        accountEmail,
        tier: authInfo.tier || authInfo.paidTier?.name || null,
        telemetrySource: hasTelemetryModelData ? 'telemetry' : 'db_fallback',
      },
      models,
      session,
      tools: {
        rows: buildToolRows(globalToolStats),
        decisions: toolDecisionSummary,
      },
    });
  } catch (error) {
    console.error('[analytics/nerd-stats] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
