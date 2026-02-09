/**
 * @vitest-environment node
 */
import { expect, test, vi } from 'vitest';
import { middleware } from '../middleware';
import { signToken } from '../lib/jwt';
import { NextRequest } from 'next/server';

// We don't stub env here because imports are hoisted and lib/jwt.ts reads env at top level.
// We rely on both signToken and middleware using the same default/env secret.

test('Middleware blocks unauthorized access to /api/files', async () => {
  const req = new NextRequest(new URL('http://localhost:3000/api/files'));
  // No cookies

  const res = await middleware(req);

  // We expect a 401 JSON response
  expect(res.status).toBe(401);
  const json = await res.json();
  expect(json.error).toBe('Unauthorized');
});

test('Middleware redirects unauthenticated page access', async () => {
  const req = new NextRequest(new URL('http://localhost:3000/'));

  const res = await middleware(req);

  // Next.js redirect uses 307 by default
  expect(res.status).toBe(307);
  expect(res.headers.get('Location')).toBe('http://localhost:3000/login');
});

test('Middleware allows access to /login', async () => {
  const req = new NextRequest(new URL('http://localhost:3000/login'));
  const res = await middleware(req);
  // NextResponse.next() returns 200
  expect(res.status).toBe(200);
});

test('Middleware allows authorized access', async () => {
  // Generate a valid token
  const token = await signToken({ sub: 'test-user', role: 'admin' });

  const req = new NextRequest(new URL('http://localhost:3000/api/files'));
  req.cookies.set('auth_token', token);

  const res = await middleware(req);

  // Should pass (200)
  expect(res.status).toBe(200);
});
