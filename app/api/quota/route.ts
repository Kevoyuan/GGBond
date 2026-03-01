import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
  try {
    const core = CoreService.getInstance();

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
