import db from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export async function getUser(username: string): Promise<User | undefined> {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export async function createUser(username: string, password: string): Promise<User> {
  const existingUser = await getUser(username);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const now = Date.now();
  const id = uuidv4();

  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    username,
    hashedPassword,
    now
  );

  return { id, username, password_hash: hashedPassword, created_at: now };
}

export async function validateCredentials(username: string, password: string): Promise<User | null> {
  const user = await getUser(username);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;

  return user;
}

export async function seedAdminUser() {
  const adminUser = await getUser('admin');
  if (!adminUser) {
    const password = process.env.ADMIN_PASSWORD || 'admin';
    console.log(`Seeding admin user. Username: admin`);
    if (!process.env.ADMIN_PASSWORD) {
        console.warn('WARNING: Default admin password is "admin". Please set ADMIN_PASSWORD environment variable.');
    }
    await createUser('admin', password);
  }
}
