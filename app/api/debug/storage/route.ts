import { NextResponse } from 'next/server';
import os from 'node:os';
import path from 'node:path';
import { getDbDebugInfo } from '@/lib/db';
import { getRuntimeHomeSource, resolveGeminiConfigDir, resolveRuntimeHome } from '@/lib/runtime-home';

export async function GET() {
  try {
    const runtimeHome = resolveRuntimeHome();
    const geminiConfigDir = resolveGeminiConfigDir(runtimeHome);
    const dbInfo = getDbDebugInfo();

    return NextResponse.json({
      runtimeHome,
      geminiConfigDir,
      runtimeHomeSource: getRuntimeHomeSource(),
      env: {
        GEMINI_CLI_HOME: process.env.GEMINI_CLI_HOME || '',
        GGBOND_DATA_HOME: process.env.GGBOND_DATA_HOME || '',
        GGBOND_HOME: process.env.GGBOND_HOME || '',
        HOME: process.env.HOME || os.homedir(),
      },
      db: dbInfo,
      expectedPaths: {
        geminiDb: path.join(geminiConfigDir, 'ggbond.db'),
        legacyAppSupportDb: path.join(os.homedir(), 'Library', 'Application Support', 'ggbond', 'gemini-home', 'ggbond.db'),
      },
      now: Date.now(),
    });
  } catch (error) {
    console.error('[debug/storage] failed:', error);
    return NextResponse.json(
      { error: 'Failed to collect storage debug info' },
      { status: 500 }
    );
  }
}
