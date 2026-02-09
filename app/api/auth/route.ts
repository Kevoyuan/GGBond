import { NextResponse } from 'next/server';
import { getAuthInfo } from '@/lib/gemini-service';

export async function GET() {
    try {
        const auth = await getAuthInfo();
        return NextResponse.json(auth);
    } catch (error) {
        console.error('Failed to read auth info:', error);
        return NextResponse.json({ error: 'Failed to read auth info' }, { status: 500 });
    }
}
