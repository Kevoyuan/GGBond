import { NextResponse } from 'next/server';
import { getIncludedDirectories, setIncludedDirectories } from '@/lib/gemini-service';

export async function GET() {
    try {
        const dirs = await getIncludedDirectories();
        return NextResponse.json({ directories: dirs });
    } catch (error) {
        console.error('Failed to read directories:', error);
        return NextResponse.json({ error: 'Failed to read directories' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { action, directory } = await req.json();

        if (!directory) {
            return NextResponse.json({ error: 'directory required' }, { status: 400 });
        }

        const current = await getIncludedDirectories();

        if (action === 'add') {
            if (!current.includes(directory)) {
                current.push(directory);
                await setIncludedDirectories(current);
            }
        } else if (action === 'remove') {
            const filtered = current.filter(d => d !== directory);
            await setIncludedDirectories(filtered);
        } else {
            return NextResponse.json({ error: 'Invalid action. Use "add" or "remove"' }, { status: 400 });
        }

        const updated = await getIncludedDirectories();
        return NextResponse.json({ directories: updated });
    } catch (error) {
        console.error('Failed to update directories:', error);
        return NextResponse.json({ error: 'Failed to update directories' }, { status: 500 });
    }
}
