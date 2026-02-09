import { expect, test, vi, describe, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const get = vi.fn();
  const all = vi.fn();
  const run = vi.fn();
  const prepare = vi.fn(() => ({ get, all, run }));
  return {
    get,
    all,
    run,
    prepare
  };
});

vi.mock('@/lib/db', () => ({
  default: {
    prepare: mocks.prepare,
  },
}));

vi.mock('@/lib/auth', () => ({
  getUserId: vi.fn(),
  ensureUserId: vi.fn(),
}));

import * as auth from '@/lib/auth';
import { GET as getSession } from '@/app/api/sessions/[id]/route';

describe('Session API Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('User can access their own session', async () => {
    const userId = 'user-123';
    const sessionId = 'session-abc';
    const session = { id: sessionId, user_id: userId, title: 'Test' };

    vi.mocked(auth.ensureUserId).mockResolvedValue(userId);
    mocks.get.mockReturnValue(session);
    mocks.all.mockReturnValue([]);

    const req = new Request(`http://localhost/api/sessions/${sessionId}`);
    const params = Promise.resolve({ id: sessionId });

    const res = await getSession(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session).toEqual(session);
    expect(mocks.prepare).toHaveBeenCalledWith('SELECT * FROM sessions WHERE id = ?');
  });

  test('User cannot access another user\'s session', async () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';
    const sessionId = 'session-xyz';
    const session = { id: sessionId, user_id: otherUserId, title: 'Secret' };

    vi.mocked(auth.ensureUserId).mockResolvedValue(userId);
    mocks.get.mockReturnValue(session);

    const req = new Request(`http://localhost/api/sessions/${sessionId}`);
    const params = Promise.resolve({ id: sessionId });

    const res = await getSession(req, { params });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  test('User claims unclaimed (legacy) session', async () => {
    const userId = 'user-123';
    const sessionId = 'session-legacy';
    // Initial state: user_id is null
    const session = { id: sessionId, user_id: null, title: 'Legacy' };

    vi.mocked(auth.ensureUserId).mockResolvedValue(userId);
    mocks.get.mockReturnValue(session); // Return the session object reference
    mocks.all.mockReturnValue([]);

    const req = new Request(`http://localhost/api/sessions/${sessionId}`);
    const params = Promise.resolve({ id: sessionId });

    const res = await getSession(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.prepare).toHaveBeenCalledWith('UPDATE sessions SET user_id = ? WHERE id = ?');
    expect(mocks.run).toHaveBeenCalledWith(userId, sessionId);
    // Note: The session object in memory is mutated by the route handler
    expect(data.session.user_id).toBe(userId);
  });
});
