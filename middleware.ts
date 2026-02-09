import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  const path = req.nextUrl.pathname;

  // Exclude public paths
  if (path.startsWith('/api/auth') || path === '/login') {
    return NextResponse.next();
  }

  // Verify token
  let payload = null;
  if (token) {
    payload = await verifyToken(token);
  }

  if (!payload) {
    // If accessing API, return 401
    if (path.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // If accessing pages, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}
