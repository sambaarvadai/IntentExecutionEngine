import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { getConfig } from '../config';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    const config = getConfig();
    const dbPath = path.join(process.cwd(), config.database.path, config.database.filename);
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
