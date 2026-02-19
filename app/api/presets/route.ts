import { NextResponse } from 'next/server';
import { getModelPresets, saveModelPreset, deleteModelPreset, type ModelPreset } from '@/lib/gemini-service';

export async function GET() {
    try {
        const presets = await getModelPresets();
        return NextResponse.json({ presets });
    } catch (error) {
        console.error('Failed to read model presets:', error);
        return NextResponse.json({ error: 'Failed to read model presets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const preset: ModelPreset = await request.json();
        await saveModelPreset(preset);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save model preset:', error);
        return NextResponse.json({ error: 'Failed to save model preset' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Preset ID required' }, { status: 400 });
        }
        await deleteModelPreset(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete model preset:', error);
        return NextResponse.json({ error: 'Failed to delete model preset' }, { status: 500 });
    }
}
