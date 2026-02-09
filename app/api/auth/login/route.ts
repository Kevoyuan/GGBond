import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, seedAdminUser } from '@/lib/users';
import { createSession } from '@/lib/session';

// Ensure admin user exists on first login attempt if not before
// This is a simple way to bootstrap in a serverless-like environment
let seeded = false;

export async function POST(req: NextRequest) {
  try {
    if (!seeded) {
      await seedAdminUser();
      seeded = true;
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await validateCredentials(username, password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await createSession(user.id, user.username);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
