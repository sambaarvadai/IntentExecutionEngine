// ------------------------------------------------------------------
// Graph Store Database - Separate from main application database
// ------------------------------------------------------------------

import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { getConfig } from '../../config';

let graphDb: Database | null = null;

export async function getGraphDatabase(): Promise<Database> {
  if (!graphDb) {
    const config = getConfig();
    // Create a separate database file for graph persistence
    const dbPath = path.join(process.cwd(), config.database.path, 'graphs.db');
    
    graphDb = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return graphDb;
}

export async function closeGraphDatabase(): Promise<void> {
  if (graphDb) {
    await graphDb.close();
    graphDb = null;
  }
}
