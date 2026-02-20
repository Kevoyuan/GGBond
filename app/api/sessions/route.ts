import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { workspace, title } = body;

    const id = crypto.randomUUID();
    const now = Date.now();
    const sessionTitle = title || 'New Chat';

    db.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(id, sessionTitle, now, now, workspace || null);

    return NextResponse.json({
      id,
      title: sessionTitle,
      created_at: now,
      updated_at: now,
      workspace: workspace || null,
      branch: null
    });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
