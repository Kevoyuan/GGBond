import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Database, RefreshCw, Server, X } from 'lucide-react';

interface BootEvent {
  name: string;
  ts?: number;
  elapsedMs: number;
  meta?: Record<string, unknown>;
}

interface DiagnosticsData {
  status?: string;
  engine?: string;
  port?: number | string;
  error?: string;
  _fallback?: boolean;
  client?: {
    cachedSidecarPort?: number | null;
    lastResolveFoundLivePort?: boolean;
    resolvingSidecarPort?: boolean;
    forcedRefreshInFlight?: boolean;
    health?: Array<{
      port: number;
      ok: boolean;
      ttlMs: number;
      circuitOpen: boolean;
      failures: number;
    }>;
    consecutiveFailures?: Array<{
      port: number;
      failures: number;
      circuitOpen: boolean;
    }>;
  };
  db?: {
    dbPath: string;
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    hasArchivedColumn: boolean;
  };
  events?: BootEvent[];
}

interface DiagnosticsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ClientPortState {
  port: number;
  ok?: boolean;
  ttlMs?: number;
  circuitOpen: boolean;
  failures: number;
}

function formatMs(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

export function DiagnosticsDialog({ open, onClose }: DiagnosticsDialogProps) {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/diagnostics');
      const payload = await response.json().catch(() => null) as DiagnosticsData | null;

      if (payload?._fallback) {
        setData(payload);
        setError(payload.error ?? null);
        return;
      }

      if (!response.ok || !payload) {
        throw new Error(payload?.error || `Diagnostics returned ${response.status}`);
      }

      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void fetchDiagnostics();
  }, [fetchDiagnostics, open]);

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const clientPortStates = useMemo(() => {
    const byPort = new Map<number, ClientPortState>();

    for (const entry of data?.client?.health ?? []) {
      byPort.set(entry.port, { ...entry });
    }

    for (const entry of data?.client?.consecutiveFailures ?? []) {
      const existing = byPort.get(entry.port);
      byPort.set(entry.port, {
        port: entry.port,
        ok: existing?.ok,
        ttlMs: existing?.ttlMs,
        circuitOpen: existing?.circuitOpen || entry.circuitOpen,
        failures: Math.max(existing?.failures ?? 0, entry.failures),
      });
    }

    return Array.from(byPort.values()).sort((a, b) => a.port - b.port);
  }, [data?.client?.consecutiveFailures, data?.client?.health]);
  const totalBootMs = events.length > 0
    ? Math.max(...events.map((event) => event.elapsedMs || 0))
    : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-tertiary)] text-[var(--accent)]">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Diagnostics</h2>
              <p className="text-xs text-[var(--text-secondary)]">Boot timeline and local runtime state</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void fetchDiagnostics()}
              disabled={loading}
              className="rounded-[var(--radius-md)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
              title="Refresh diagnostics"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Close diagnostics"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <div className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <Server className="h-3.5 w-3.5" />
                Sidecar
              </div>
              <div className="font-mono text-sm text-[var(--text-primary)]">{data?.status || 'unknown'}</div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">{data?.engine || 'not connected'}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Port</div>
              <div className="font-mono text-sm text-[var(--text-primary)]">{data?.port ?? 'unknown'}</div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
              <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Boot Total</div>
              <div className="font-mono text-sm text-[var(--text-primary)]">{totalBootMs ? formatMs(totalBootMs) : 'pending'}</div>
            </div>
          </section>

          {data?.error && (
            <section className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              {data.error}
            </section>
          )}

          {data?._fallback && (
            <section className="rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Browser-side fallback
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-[var(--text-secondary)]">Cached port</span>
                  <div className="font-mono text-[var(--text-primary)]">{data.client?.cachedSidecarPort ?? 'none'}</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Last live resolve</span>
                  <div className="font-mono text-[var(--text-primary)]">{String(Boolean(data.client?.lastResolveFoundLivePort))}</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Resolving port</span>
                  <div className="font-mono text-[var(--text-primary)]">{String(Boolean(data.client?.resolvingSidecarPort))}</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Forced refresh</span>
                  <div className="font-mono text-[var(--text-primary)]">{String(Boolean(data.client?.forcedRefreshInFlight))}</div>
                </div>
              </div>
              {clientPortStates.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-[var(--radius-sm)] border border-amber-500/20">
                  {clientPortStates.map((entry) => (
                    <div
                      key={entry.port}
                      className="grid grid-cols-[80px_1fr_80px] gap-2 border-b border-amber-500/10 px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="font-mono text-[var(--text-primary)]">{entry.port}</span>
                      <span className="text-[var(--text-secondary)]">
                        {entry.ok ? 'healthy' : 'unhealthy'}
                        {entry.circuitOpen ? ' / circuit open' : ''}
                      </span>
                      <span className="text-right font-mono text-[var(--text-primary)]">{entry.failures} fails</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Database className="h-4 w-4 text-[var(--text-secondary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Database</h3>
            </div>
            <div className="grid gap-2 px-4 py-3 text-sm">
              {data?.db ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <span className="text-[var(--text-secondary)]">Path</span>
                    <span className="break-all font-mono text-xs text-[var(--text-primary)]">{data.db.dbPath}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <span className="text-[var(--text-secondary)]">Sessions</span>
                    <span className="text-[var(--text-primary)]">
                      {data.db.totalSessions} total, {data.db.activeSessions} active, {data.db.archivedSessions} archived
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-[var(--text-tertiary)]">Database details are unavailable.</span>
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Boot Timeline</h3>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {events.length > 0 ? (
                events.map((event, index) => (
                  <div
                    key={`${event.name}-${event.ts ?? index}`}
                    className="grid grid-cols-[84px_1fr] gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
                  >
                    <span className="font-mono text-[var(--accent)]">{formatMs(event.elapsedMs || 0)}</span>
                    <span className="min-w-0 truncate font-mono text-[var(--text-primary)]" title={event.name}>
                      {event.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-sm text-[var(--text-tertiary)]">
                  No boot events recorded yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
