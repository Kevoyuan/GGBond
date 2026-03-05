import { NextResponse } from 'next/server';
import path from 'path';
import {
  getKnownModels,
  readSettings,
  readProjectSettings,
  writeProjectSettings,
} from '@/lib/gemini-service';

type SteeringPayload = {
  workspacePath?: string;
  model?: string;
  profile?: string;
  reset?: boolean;
};

function normalizeWorkspacePath(input?: string) {
  const trimmed = (input || '').trim();
  if (!trimmed || trimmed === 'Default') return process.cwd();
  return path.resolve(trimmed);
}

function getModelName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string') {
    const name = ((value as { name: string }).name || '').trim();
    return name || null;
  }
  return null;
}

function getProfileName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string') {
    const name = ((value as { name: string }).name || '').trim();
    return name || null;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspacePath = normalizeWorkspacePath(searchParams.get('workspacePath') || undefined);
    const [globalSettings, workspaceSettings, knownModels] = await Promise.all([
      readSettings(),
      readProjectSettings(workspacePath),
      getKnownModels(),
    ]);

    const globalModel = getModelName(globalSettings.model);
    const workspaceModel = getModelName(workspaceSettings.model);
    const globalProfile = getProfileName(globalSettings.profile);
    const workspaceProfile = getProfileName(workspaceSettings.profile);

    return NextResponse.json({
      workspacePath,
      activeModel: workspaceModel || globalModel || 'gemini-2.5-flash',
      activeProfile: workspaceProfile || globalProfile || 'default',
      workspaceOverrides: {
        hasModelOverride: Boolean(workspaceModel),
        hasProfileOverride: Boolean(workspaceProfile),
        model: workspaceModel,
        profile: workspaceProfile,
      },
      knownModels,
      availableProfiles: ['default', 'autoEdit', 'plan', 'yolo'],
    });
  } catch (error) {
    console.error('Failed to load model steering config:', error);
    return NextResponse.json({ error: 'Failed to load model steering config' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as SteeringPayload;
    const workspacePath = normalizeWorkspacePath(body.workspacePath);
    const workspaceSettings = await readProjectSettings(workspacePath);

    if (body.reset) {
      delete workspaceSettings.model;
      delete workspaceSettings.profile;
      await writeProjectSettings(workspaceSettings, workspacePath);
      return NextResponse.json({ success: true, workspacePath, reset: true });
    }

    const nextSettings = { ...workspaceSettings };

    if (typeof body.model === 'string' && body.model.trim()) {
      nextSettings.model = { name: body.model.trim() };
    }
    if (typeof body.profile === 'string' && body.profile.trim()) {
      nextSettings.profile = body.profile.trim();
    }

    await writeProjectSettings(nextSettings, workspacePath);
    return NextResponse.json({ success: true, workspacePath });
  } catch (error) {
    console.error('Failed to save model steering config:', error);
    return NextResponse.json({ error: 'Failed to save model steering config' }, { status: 500 });
  }
}
