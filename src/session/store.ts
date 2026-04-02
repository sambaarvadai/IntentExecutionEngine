import { Database } from 'sqlite';
import { SessionContext, TurnRecord } from './types';

export class SessionStore {
  constructor(private db: Database) {
    this.init();
  }

  private async init(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS nl2db_sessions (
        session_id TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  async get(sessionId: string): Promise<SessionContext | null> {
    const stmt = await this.db.prepare(
      'SELECT data FROM nl2db_sessions WHERE session_id = ?'
    );
    const row = await stmt.get(sessionId);
    await stmt.finalize();
    
    if (!row) return null;
    
    try {
      return JSON.parse((row as any).data);
    } catch {
      return null;
    }
  }

  async upsert(ctx: SessionContext): Promise<void> {
    const stmt = await this.db.prepare(`
      INSERT OR REPLACE INTO nl2db_sessions (session_id, data, updated_at)
      VALUES (?, ?, ?)
    `);
    await stmt.run(
      ctx.sessionId,
      JSON.stringify(ctx),
      Date.now()
    );
    await stmt.finalize();
  }

  async appendTurn(sessionId: string, turn: TurnRecord): Promise<SessionContext> {
    let ctx = await this.get(sessionId);
    
    if (!ctx) {
      ctx = createBlankSession(sessionId);
    }
    
    ctx.turns.push(turn);
    
    // Trim to last 5 turns
    if (ctx.turns.length > 5) {
      ctx.turns = ctx.turns.slice(-5);
    }
    
    await this.upsert(ctx);
    return ctx;
  }

  async setUserDefinedTerm(
    sessionId: string,
    term: string,
    definition: SessionContext['userDefinedTerms'][string]
  ): Promise<void> {
    let ctx = await this.get(sessionId);
    
    if (!ctx) {
      ctx = createBlankSession(sessionId);
    }
    
    ctx.userDefinedTerms[term.toLowerCase()] = definition;
    await this.upsert(ctx);
  }

  async delete(sessionId: string): Promise<void> {
    const stmt = await this.db.prepare(
      'DELETE FROM nl2db_sessions WHERE session_id = ?'
    );
    await stmt.run(sessionId);
    await stmt.finalize();
  }

  async cleanup(maxAgeMs: number): Promise<number> {
    const cutoffTime = Date.now() - maxAgeMs;
    const stmt = await this.db.prepare(
      'DELETE FROM nl2db_sessions WHERE updated_at < ?'
    );
    const result = await stmt.run(cutoffTime);
    await stmt.finalize();
    return result.changes || 0;
  }
}

export function createBlankSession(sessionId: string): SessionContext {
  return {
    sessionId,
    turns: [],
    userDefinedTerms: {}
  };
}
