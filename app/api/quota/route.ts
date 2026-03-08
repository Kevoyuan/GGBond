import { NextResponse } from 'next/server';
import { CoreService } from '@/lib/core-service';

export async function GET() {
  try {
    const core = CoreService.getInstance();

    // Do NOT trigger CoreService.initialize() on cold start.
    // If core is not yet initialized (no active chat session), return null quota
    // to avoid blocking the startup path with heavy initialization.
    if (!core.config) {
      return NextResponse.json({ quota: null });
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
