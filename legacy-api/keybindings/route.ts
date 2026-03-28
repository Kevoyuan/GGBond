import { NextResponse } from '@/src-sidecar/mock-next-server';
import { getKeybindingsPath, readKeybindings, writeKeybindings, type GeminiKeybinding } from '@/lib/gemini-service';

function isValidKeybinding(entry: unknown): entry is GeminiKeybinding {
    return !!entry
        && typeof entry === 'object'
        && typeof (entry as GeminiKeybinding).command === 'string'
        && typeof (entry as GeminiKeybinding).key === 'string';
}

export async function GET() {
    try {
        const keybindings = await readKeybindings();
        return NextResponse.json({
            keybindings,
            path: getKeybindingsPath(),
            docsUrl: 'https://geminicli.com/docs/reference/keyboard-shortcuts/',
        });
    } catch (error) {
        console.error('Failed to read keybindings:', error);
        return NextResponse.json({ error: 'Failed to read keybindings' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const keybindings = body?.keybindings;
        if (!Array.isArray(keybindings) || !keybindings.every(isValidKeybinding)) {
            return NextResponse.json(
                { error: 'Expected "keybindings" to be an array of { command, key } objects.' },
                { status: 400 }
            );
        }

        await writeKeybindings(keybindings);
        return NextResponse.json({
            keybindings,
            path: getKeybindingsPath(),
            docsUrl: 'https://geminicli.com/docs/reference/keyboard-shortcuts/',
        });
    } catch (error) {
        console.error('Failed to update keybindings:', error);
        return NextResponse.json({ error: 'Failed to update keybindings' }, { status: 500 });
    }
}
