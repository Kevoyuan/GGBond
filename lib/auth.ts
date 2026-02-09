import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function getUserId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id');
  return userId?.value;
}

export async function ensureUserId(): Promise<string> {
  const cookieStore = await cookies();
  let userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    userId = uuidv4();
    cookieStore.set({
        name: 'user_id',
        value: userId,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  return userId;
}
