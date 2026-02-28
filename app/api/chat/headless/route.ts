import { NextResponse } from 'next/server';
import { POST as chatPost } from '@/app/api/chat/route';

type HeadlessChatBody = {
  prompt?: string;
  model?: string;
  systemInstruction?: string;
  sessionId?: string;
  workspace?: string;
  modelSettings?: Record<string, unknown>;
  parentId?: string | number;
  selectedAgent?: unknown;
  images?: Array<{ dataUrl: string; type: string; name: string }>;
  lowLatencyMode?: boolean;
  mode?: 'code' | 'plan' | 'ask';
  approvalMode?: string;
};

const isHeadlessEnabled = () =>
  process.env.GEMINI_HEADLESS === '1' ||
  process.env.GEMINI_HEADLESS === 'true';

export async function POST(req: Request) {
  try {
    const isHeadless = isHeadlessEnabled();

    if (!isHeadless) {
      return NextResponse.json(
        { error: 'Headless mode is disabled. Set GEMINI_HEADLESS=1 to enable /api/chat/headless.' },
        { status: 400 }
      );
    }

    const body = await req.json() as HeadlessChatBody;
    const forwardedReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      // Native-aligned forwarding: do not inject route-level defaults or overrides.
      body: JSON.stringify(body),
    });

    return chatPost(forwardedReq);
  } catch (error) {
    console.error('[headless] Error forwarding to /api/chat:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Headless chat failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const isHeadless = isHeadlessEnabled();

  return NextResponse.json({
    headless: isHeadless,
    message: isHeadless
      ? 'Headless mode is enabled. POST requests are forwarded to /api/chat without route-level overrides.'
      : 'Headless mode is disabled. Set GEMINI_HEADLESS=1 or use --headless flag.',
  });
}
