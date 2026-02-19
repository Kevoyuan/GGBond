import { NextResponse } from 'next/server';
import { getModelPresets, resolveModelForContext, type ModelPreset } from '@/lib/gemini-service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { presetId, messageLength, messageContent } = body;

        if (!presetId || messageLength === undefined || !messageContent) {
            return NextResponse.json(
                { error: 'Missing required fields: presetId, messageLength, messageContent' },
                { status: 400 }
            );
        }

        const presets = await getModelPresets();
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            return NextResponse.json(
                { error: 'Preset not found' },
                { status: 404 }
            );
        }

        const resolved = resolveModelForContext(preset, messageLength, messageContent);

        return NextResponse.json({
            preset: preset.name,
            resolved,
        });
    } catch (error) {
        console.error('Failed to resolve model:', error);
        return NextResponse.json({ error: 'Failed to resolve model' }, { status: 500 });
    }
}
