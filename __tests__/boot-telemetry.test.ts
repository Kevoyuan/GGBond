import { beforeEach, describe, expect, it } from 'vitest';
import { bootImport, bootMark, bootReset, bootTimeline } from '@/lib/boot-telemetry';

describe('boot telemetry', () => {
  beforeEach(() => {
    bootReset();
  });

  it('records ordered boot marks with elapsed times', () => {
    bootMark('sidecar:start');
    bootMark('sidecar:ready', { port: 14321 });

    const events = bootTimeline();
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('sidecar:start');
    expect(events[0].elapsedMs).toBe(0);
    expect(events[1].name).toBe('sidecar:ready');
    expect(events[1].meta).toEqual({ port: 14321 });
  });

  it('imports loading page events and normalizes elapsed time', () => {
    bootImport([
      { name: 'loading:page-start', ts: 1000, elapsedMs: 0 },
      { name: 'loading:probe-success', ts: 1400, elapsedMs: 400 },
    ]);

    expect(bootTimeline()).toEqual([
      { name: 'loading:page-start', ts: 1000, elapsedMs: 0 },
      { name: 'loading:probe-success', ts: 1400, elapsedMs: 400 },
    ]);
  });
});
