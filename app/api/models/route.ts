import { NextResponse } from 'next/server';
import { getModelConfig } from '@/lib/gemini-service';

export async function GET() {
    try {
        const config = await getModelConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to read model config:', error);
        return NextResponse.json({ error: 'Failed to read model config' }, { status: 500 });
    }
}
