import { NextResponse } from 'next/server';
import { readSettingsJson, writeSettingsJson } from '@/lib/settings';

export async function GET() {
  const settings = await readSettingsJson();
  return NextResponse.json({
    core: settings.tools?.core || [],
    exclude: settings.tools?.exclude || [],
    allowed: settings.tools?.allowed || [],
    sandbox: settings.tools?.sandbox,
    approvalMode: settings.tools?.approvalMode || 'default',
    shell: settings.tools?.shell || {}
  });
}

export async function POST(req: Request) {
  const { field, value } = await req.json();
  const settings = await readSettingsJson();
  settings.tools = settings.tools || {};
  settings.tools[field] = value;
  await writeSettingsJson(settings);
  return NextResponse.json({ success: true });
}
