// ------------------------------------------------------------------
// Graph Store Schema
// ------------------------------------------------------------------

import { Database } from 'sqlite';

export function ensureGraphStoreSchema(db: Database): void {
  // Main stored graphs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stored_graphs (
      id              TEXT PRIMARY KEY,
      prompt          TEXT NOT NULL,
      graph_json      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'draft',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      generation_ms   INTEGER NOT NULL DEFAULT 0,
      execution_ms    INTEGER NOT NULL DEFAULT 0,
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_used_at    INTEGER,
      approved_by     TEXT,
      approval_note   TEXT,
      node_count      INTEGER NOT NULL DEFAULT 0,
      success         INTEGER NOT NULL DEFAULT 1,  -- SQLite boolean
      error_message   TEXT
    );
  `);

  // Status index for filtering
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stored_graphs_status 
    ON stored_graphs(status);
  `);

  // Created at index for sorting
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stored_graphs_created_at 
    ON stored_graphs(created_at DESC);
  `);

  // Full-text search table for prompt search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS stored_graphs_fts 
    USING fts5(
      prompt,
      content='stored_graphs',
      content_rowid='rowid'
    );
  `);

  // FTS trigger for inserts
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS stored_graphs_fts_insert
    AFTER INSERT ON stored_graphs BEGIN
      INSERT INTO stored_graphs_fts(rowid, prompt)
      VALUES (new.rowid, new.prompt);
    END;
  `);

  // FTS trigger for updates
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS stored_graphs_fts_update
    AFTER UPDATE ON stored_graphs BEGIN
      INSERT INTO stored_graphs_fts(stored_graphs_fts, rowid, prompt)
      VALUES ('delete', old.rowid, old.prompt);
      INSERT INTO stored_graphs_fts(rowid, prompt)
      VALUES (new.rowid, new.prompt);
    END;
  `);
}
