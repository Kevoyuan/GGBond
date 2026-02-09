import { NextResponse } from 'next/server';
import { readSettings, mergeSettings } from '@/lib/gemini-service';

export async function GET() {
    try {
        const settings = await readSettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Failed to read settings:', error);
        return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const partial = await req.json();
        const merged = await mergeSettings(partial);
        return NextResponse.json(merged);
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
