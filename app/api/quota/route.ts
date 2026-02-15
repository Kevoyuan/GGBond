
import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import { getGeminiEnv } from '@/lib/gemini-utils';

export async function GET() {
    try {
        const core = CoreService.getInstance();

        if (!core.config) {
            // Keep CoreService runtime home aligned with CLI env selection logic (skills/auth consistency).
            const env = getGeminiEnv();
            if (env.GEMINI_CLI_HOME) {
                process.env.GEMINI_CLI_HOME = env.GEMINI_CLI_HOME;
            }

            console.log('[api/quota] CoreService not initialized, initializing with defaults for quota check...');
            await core.initialize({
                sessionId: 'quota-check-' + crypto.randomUUID(),
                model: 'gemini-2.5-pro',
                cwd: process.cwd(),
                approvalMode: 'safe'
            });
        }

        const quota = await core.getQuota();

        return NextResponse.json({ quota });
    } catch (error) {
        console.error('Error fetching quota:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
