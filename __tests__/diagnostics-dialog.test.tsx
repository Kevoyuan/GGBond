import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticsDialog } from '@/components/settings/DiagnosticsDialog';

describe('DiagnosticsDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders browser fallback health and consecutive-only port state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'unavailable',
      engine: 'browser-interceptor',
      port: 4001,
      error: 'Sidecar not available',
      _fallback: true,
      client: {
        cachedSidecarPort: null,
        lastResolveFoundLivePort: false,
        resolvingSidecarPort: false,
        forcedRefreshInFlight: false,
        health: [
          { port: 4001, ok: false, ttlMs: 120, circuitOpen: false, failures: 1 },
        ],
        consecutiveFailures: [
          { port: 4002, failures: 6, circuitOpen: true },
        ],
      },
      events: [
        { name: 'client:diagnostics-fallback', ts: 1000, elapsedMs: 0 },
      ],
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<DiagnosticsDialog open onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Browser-side fallback')).toBeTruthy();
    });

    expect(screen.getAllByText('4001').length).toBeGreaterThan(0);
    expect(screen.getByText('4002')).toBeTruthy();
    expect(screen.getByText('6 fails')).toBeTruthy();
    expect(screen.getByText('unhealthy / circuit open')).toBeTruthy();
  });
});
