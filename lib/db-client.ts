import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

// Cache the db instance
let dbInstance: Database | null = null;
let dbUrlCache: string | null = null;

async function getDbUrl(): Promise<string> {
    if (!dbUrlCache) {
        try {
            dbUrlCache = await invoke<string>('get_db_url');
        } catch {
            dbUrlCache = 'sqlite:ggbond.db';
        }
    }
    return dbUrlCache;
}

export async function getDb(): Promise<Database> {
    if (!dbInstance) {
        const url = await getDbUrl();
        dbInstance = await Database.load(url);
    }
    return dbInstance;
}

export interface Session {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
    workspace?: string;
    branch?: string | null;
    archived: number;
}

export interface DbMessage {
    id: number;
    session_id: string;
    role: 'user' | 'model' | 'assistant';
    content: string;
    stats?: string;
    thought?: string | null;
    citations?: string | null;
    images?: string | null;
    parent_id?: number | null;
    created_at: number;
    updated_at?: number;
}

export const sessions = {
    async getAll(): Promise<Session[]> {
        const db = await getDb();
        return db.select<Session[]>(
            "SELECT * FROM sessions WHERE workspace IS NOT NULL AND trim(workspace) <> '' ORDER BY updated_at DESC"
        );
    },

    async get(id: string): Promise<Session | null> {
        const db = await getDb();
        const rows = await db.select<Session[]>(
            "SELECT * FROM sessions WHERE id = ? AND workspace IS NOT NULL AND trim(workspace) <> ''",
            [id]
        );
        return rows[0] || null;
    },

    async create(session: Partial<Session>): Promise<void> {
        const db = await getDb();
        const workspace = typeof session.workspace === 'string' ? session.workspace.trim() : '';
        if (!workspace) {
            throw new Error('workspace is required');
        }
        await db.execute(
            'INSERT INTO sessions (id, title, created_at, updated_at, workspace, branch, archived) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                session.id,
                session.title || 'New Chat',
                session.created_at || Date.now(),
                session.updated_at || Date.now(),
                workspace,
                session.branch || null,
                session.archived || 0
            ]
        );
    },

    async update(id: string, updates: Partial<Session>): Promise<void> {
        const db = await getDb();
        const setClauses: string[] = [];
        const values: any[] = [];
        for (const [k, v] of Object.entries(updates)) {
            if (k === 'id') continue;
            setClauses.push(`${k} = ?`);
            values.push(v);
        }
        if (setClauses.length === 0) return;
        values.push(id);
        await db.execute(
            `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );
    },

    async delete(id: string): Promise<void> {
        const db = await getDb();
        await db.execute('DELETE FROM sessions WHERE id = ?', [id]);
    }
};

export const messages = {
    async getBySession(sessionId: string): Promise<DbMessage[]> {
        const db = await getDb();
        return db.select<DbMessage[]>('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC', [sessionId]);
    },

    async create(msg: Partial<DbMessage>): Promise<number> {
        const db = await getDb();
        const result = await db.execute(
            `INSERT INTO messages 
       (session_id, role, content, stats, thought, citations, images, parent_id, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                msg.session_id,
                msg.role,
                msg.content || '',
                msg.stats || null,
                msg.thought || null,
                msg.citations || null,
                msg.images || null,
                msg.parent_id || null,
                msg.created_at || Date.now(),
                msg.updated_at || Date.now()
            ]
        );
        return result.lastInsertId || 0;
    },

    async update(id: number, updates: Partial<DbMessage>): Promise<void> {
        const db = await getDb();
        const setClauses: string[] = [];
        const values: any[] = [];
        for (const [k, v] of Object.entries(updates)) {
            if (k === 'id') continue;
            setClauses.push(`${k} = ?`);
            values.push(v);
        }
        if (setClauses.length === 0) return;
        values.push(id);
        await db.execute(
            `UPDATE messages SET ${setClauses.join(', ')} WHERE id = ?`,
            values
        );
    },

    async deleteOrphaned(): Promise<void> {
        // handled implicitly or explicitly when session dies
    }
};

export const config = {
    async get(key: string): Promise<string | null> {
        const db = await getDb();
        const rows = await db.select<{ value: string }[]>('SELECT value FROM app_config WHERE key = ?', [key]);
        return rows.length > 0 ? rows[0].value : null;
    },
    async set(key: string, value: string): Promise<void> {
        const db = await getDb();
        await db.execute(
            'INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, ?)',
            [key, value, Date.now()]
        );
    }
};

export const chatSnapshots = {
    async list(sessionId?: string): Promise<any[]> {
        const db = await getDb();
        if (sessionId) {
            return db.select(`
        SELECT cs.*, s.title as session_title
        FROM chat_snapshots cs
        JOIN sessions s ON cs.session_id = s.id
        WHERE cs.session_id = ?
        ORDER BY cs.created_at DESC
      `, [sessionId]);
        }
        return db.select(`
      SELECT cs.*, s.title as session_title
      FROM chat_snapshots cs
      JOIN sessions s ON cs.session_id = s.id
      ORDER BY cs.created_at DESC
    `);
    },
    async save(sessionId: string, tag: string, title?: string, messageCount?: number): Promise<void> {
        const db = await getDb();
        await db.execute(`
      INSERT OR REPLACE INTO chat_snapshots (session_id, tag, title, message_count, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [sessionId, tag, title || null, messageCount || 0, Date.now()]);
    },
    async delete(sessionId: string, tag: string): Promise<void> {
        const db = await getDb();
        await db.execute('DELETE FROM chat_snapshots WHERE session_id = ? AND tag = ?', [sessionId, tag]);
    }
};

export const dbClient = {
    sessions,
    messages,
    config,
    chatSnapshots
};
