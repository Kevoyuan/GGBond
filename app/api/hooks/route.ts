import { NextResponse } from 'next/server';
import { getHooksConfig, mergeSettings, getHookEvents } from '@/lib/gemini-service';

export async function GET() {
    try {
        const config = await getHooksConfig();
        const hookEvents = await getHookEvents();
        return NextResponse.json({ ...config, availableEvents: hookEvents });
    } catch (error) {
        console.error('Failed to read hooks config:', error);
        return NextResponse.json({ error: 'Failed to read hooks config' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const updates = await req.json();
        const merged = await mergeSettings(updates);
        return NextResponse.json({
            hooksConfig: merged.hooksConfig || {},
            hooks: merged.hooks || {},
        });
    } catch (error) {
        console.error('Failed to update hooks config:', error);
        return NextResponse.json({ error: 'Failed to update hooks config' }, { status: 500 });
    }
}
