import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

// Secret for JWT signing
// In production, this should be a strong, random secret from environment variables.
// For this local tool, we'll use a fallback or a generated one if not provided.
const JWT_SECRET_KEY = process.env.AUTH_SECRET || 'gemini-gui-local-secret-key-change-me';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET_KEY);

export async function signToken(payload: JWTPayload): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  // Default expiration: 7 days
  const exp = iat + 60 * 60 * 24 * 7;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(exp)
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    // console.error('Token verification failed');
    return null;
  }
}
