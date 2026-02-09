import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. Decrypt the session from the cookie
  const cookie = req.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  // 2. Check if the current route is explicitly public
  if (publicRoutes.some(route => path === route || path.startsWith(route + '/'))) {
    // If user is already logged in and tries to access /login, redirect to /
    if (path === '/login' && session) {
      return NextResponse.redirect(new URL('/', req.nextUrl));
    }
    return NextResponse.next();
  }

  // 3. Redirect to /login if the user is not authenticated
  if (!session) {
    // Return 401 for API routes
    if (path.startsWith('/api/')) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Redirect to login for pages
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
