import { pbkdf2Sync, randomBytes } from 'node:crypto';

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}
