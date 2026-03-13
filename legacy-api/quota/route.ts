import { NextResponse } from '@/src-sidecar/mock-next-server';
import { CoreService } from '@/lib/core-service';
import { Config, AuthType } from '@google/gemini-cli-core';
import fs from 'fs';
import path from 'path';
import { resolveDefaultWorkspaceRoot, resolveRuntimeHome, resolveGeminiConfigDir, resolveGeminiCliHome } from '@/lib/runtime-home';

export async function GET() {
  try {
    const core = CoreService.getInstance();
    let quotaPromise;

    if (core.config) {
      quotaPromise = core.getQuota();
    } else {
      // Do NOT trigger full CoreService.initialize() on cold start to avoid side-effects.
      // Instead, use a temporary lightweight Config to fetch quota.
      const runtimeHome = resolveRuntimeHome();
      const geminiCliHome = resolveGeminiCliHome(runtimeHome);
      const settingsPath = path.join(resolveGeminiConfigDir(geminiCliHome), 'settings.json');
      let authType = AuthType.USE_GEMINI;

      if (fs.existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          const selectedType = settings?.security?.auth?.selectedType || settings?.selectedAuthType;
          if (selectedType) authType = selectedType as AuthType;
        } catch (e) {
          console.warn('[Quota] Failed to parse settings.json', e);
        }
      }

      const tempConfig = new Config({
        sessionId: 'quota-fetch',
        model: 'gemini-3-pro',
        cwd: resolveDefaultWorkspaceRoot(),
        targetDir: resolveDefaultWorkspaceRoot(),
        interactive: false,
        checkpointing: false,
        debugMode: false
      });

      await tempConfig.initialize();

      try {
        await tempConfig.refreshAuth(authType);
      } catch (e) {
        // Fallback auth
        try {
          if (authType === AuthType.LOGIN_WITH_GOOGLE) {
            await tempConfig.refreshAuth(AuthType.USE_GEMINI);
          } else {
            await tempConfig.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
          }
        } catch (fallbackError) {
          console.error('[Quota] Auth fallback failed:', fallbackError);
        }
      }

      quotaPromise = tempConfig.refreshUserQuota();
    }

    // Keep server responsive even if upstream quota retrieval stalls.
    const quota = await Promise.race([
      quotaPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);

    return NextResponse.json({ quota });
  } catch (error) {
    console.error('Error fetching quota:', error);
    return NextResponse.json({ quota: null, error: 'Internal Server Error' }, { status: 200 });
  }
}
