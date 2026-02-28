import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';
import { getGeminiEnv } from '@/lib/gemini-utils';

export async function GET() {
  try {
    const core = CoreService.getInstance();
    const env = getGeminiEnv();

    if (env.GEMINI_CLI_HOME) {
      process.env.GEMINI_CLI_HOME = env.GEMINI_CLI_HOME;
    }
    if (env.GGBOND_DATA_HOME) {
      process.env.GGBOND_DATA_HOME = env.GGBOND_DATA_HOME;
    }

    if (!core.config) {
      await core.initialize({
        sessionId: 'quota-check-' + crypto.randomUUID(),
        model: 'gemini-2.5-pro',
        cwd: process.cwd(),
        approvalMode: 'safe',
      });
    }

    // Keep server responsive even if upstream quota retrieval stalls.
    const quota = await Promise.race([
      core.getQuota(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);

    return NextResponse.json({ quota });
  } catch (error) {
    console.error('Error fetching quota:', error);
    return NextResponse.json({ quota: null, error: 'Internal Server Error' }, { status: 200 });
  }
}
