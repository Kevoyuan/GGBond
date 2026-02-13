import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Find running jobs for this session
    const runningJobs = db.prepare(`
      SELECT id, session_id, user_message_id, status, current_content,
             current_thought, created_at, updated_at, completed_at, error
      FROM background_jobs
      WHERE session_id = ? AND status = 'running'
      ORDER BY created_at DESC
    `).all(sessionId) as Array<{
      id: string;
      session_id: string;
      user_message_id: number | null;
      status: string;
      current_content: string | null;
      current_thought: string | null;
      created_at: number;
      updated_at: number;
      completed_at: number | null;
      error: string | null;
    }>;

    // Also get the most recent job (regardless of status)
    const latestJob = db.prepare(`
      SELECT id, session_id, user_message_id, status, current_content,
             current_thought, created_at, updated_at, completed_at, error
      FROM background_jobs
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(sessionId) as {
      id: string;
      session_id: string;
      user_message_id: number | null;
      status: string;
      current_content: string | null;
      current_thought: string | null;
      created_at: number;
      updated_at: number;
      completed_at: number | null;
      error: string | null;
    } | undefined;

    return NextResponse.json({
      runningJobs,
      latestJob: latestJob || null,
      hasRunningJobs: runningJobs.length > 0
    });
  } catch (error) {
    console.error('[status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
