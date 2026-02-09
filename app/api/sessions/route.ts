import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { ensureUserId } from '@/lib/auth';

export async function GET() {
  try {
    const userId = await ensureUserId();
    const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST() {
    // Maybe allow creating a session explicitly?
    // For now, sessions are created via chat
    return NextResponse.json({ message: 'Use /api/chat to create a session' }, { status: 405 });
}
