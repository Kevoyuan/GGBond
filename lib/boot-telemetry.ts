export interface BootEvent {
  name: string;
  ts: number;
  elapsedMs: number;
  meta?: Record<string, unknown>;
}

const MAX_EVENTS = 100;
const STORAGE_KEY = 'ggbond:boot-events';
const events: BootEvent[] = [];
let originTs = 0;

function normalizeEvent(event: BootEvent): BootEvent {
  const ts = typeof event.ts === 'number' ? event.ts : Date.now();
  if (originTs === 0 || ts < originTs) originTs = ts;
  return {
    name: event.name,
    ts,
    elapsedMs: Math.max(0, ts - originTs),
    ...(event.meta ? { meta: event.meta } : {}),
  };
}

export function bootMark(name: string, meta?: Record<string, unknown>): void {
  const now = Date.now();
  if (originTs === 0) originTs = now;
  const entry: BootEvent = { name, ts: now, elapsedMs: now - originTs };
  if (meta !== undefined) entry.meta = meta;
  events.push(entry);
  if (events.length > MAX_EVENTS) events.shift();
}

export function bootImport(importedEvents: BootEvent[]): void {
  for (const event of importedEvents) {
    if (!event || typeof event.name !== 'string') continue;
    events.push(normalizeEvent(event));
  }
  events.sort((a, b) => a.ts - b.ts);
  while (events.length > MAX_EVENTS) events.shift();
}

export function bootImportFromSessionStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      bootImport(parsed as BootEvent[]);
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Boot telemetry must never affect app startup.
  }
}

export function bootTimeline(): BootEvent[] {
  return events.slice();
}

export function bootOrigin(): number {
  return originTs;
}

export function bootReset(): void {
  events.length = 0;
  originTs = 0;
}
