import { NextResponse } from 'next/server';
import { getSessions, createSession } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const sessions = getSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    const id = uuidv4();
    const session = createSession(id, title || 'New Chat');
    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
