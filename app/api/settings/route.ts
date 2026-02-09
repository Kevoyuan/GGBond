import { NextResponse } from 'next/server';
import { readSettingsJson, writeSettingsJson, getMergedSettings } from '@/lib/settings';

export async function GET() {
  const settings = await getMergedSettings();
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json();
  const settings = await readSettingsJson('user');
  
  // Merge or replace top-level keys
  const newSettings = { ...settings, ...body };
  
  await writeSettingsJson(newSettings, 'user');
  return NextResponse.json(newSettings);
}
