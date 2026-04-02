// ------------------------------------------------------------------
// Graph Store Repository
// ------------------------------------------------------------------

import { randomUUID } from 'crypto';
import { getGraphDatabase } from './db';
import { ensureGraphStoreSchema } from './schema';
import {
  StoredGraph,
  CreateGraphInput,
  UpdateGraphStatusInput,
  StoreQuery,
  GraphStatus
} from './types';
import { ExecutionGraph } from '../types';

export class GraphRepository {
  constructor() {
    // Call ensureGraphStoreSchema(getGraphDatabase()) on construction
    // This is idempotent — safe to call every time
    this.init();
  }

  private async init(): Promise<void> {
    const db = await getGraphDatabase();
    ensureGraphStoreSchema(db);
  }

  async save(input: CreateGraphInput): Promise<StoredGraph> {
    const db = await getGraphDatabase();
    const now = Date.now();
    
    // Generate id via crypto.randomUUID()
    const id = randomUUID();
    
    // Serialize input.graph to JSON string
    const graphJson = JSON.stringify(input.graph);
    
    // Serialize input.intent to JSON string if provided
    const intentJson = input.intent ? JSON.stringify(input.intent) : null;
    
    // Calculate node count
    const nodeCount = input.graph.nodes?.length || 0;
    
    // Insert row into stored_graphs
    await db.run(`
      INSERT INTO stored_graphs (
        id, prompt, graph_json, intent_json, status, created_at, updated_at,
        generation_ms, execution_ms, execution_count, last_used_at,
        approved_by, approval_note, node_count, success, error_message, prompt_embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      input.prompt,
      graphJson,
      intentJson,
      'draft', // initial status
      now,
      now,
      input.generationMs,
      input.executionMs,
      0, // initial execution count
      null, // last_used_at
      null, // approved_by
      null, // approval_note
      nodeCount,
      input.success ? 1 : 0, // SQLite boolean
      input.errorMessage || null,
      input.promptEmbedding || null
    );
    
    // Return the full StoredGraph
    const result = await this.findById(id);
    if (!result) {
      throw new Error(`Failed to retrieve saved graph: ${id}`);
    }
    return result;
  }

  async findById(id: string): Promise<StoredGraph | null> {
    const db = await getGraphDatabase();
    const rows = await db.all(`
      SELECT 
        id, prompt, graph_json, intent_json, status, created_at, updated_at,
        generation_ms, execution_ms, execution_count, last_used_at,
        approved_by, approval_note, node_count, success, error_message, prompt_embedding
      FROM stored_graphs 
      WHERE id = ?
    `, id);
    
    if (rows.length === 0) return null;
    
    // Return as StoredGraph with graphJson field (keep as string)
    return this.toStoredGraph(rows[0]);
  }

  async updateStatus(input: UpdateGraphStatusInput): Promise<StoredGraph> {
    const db = await getGraphDatabase();
    const now = Date.now();
    
    await db.run(`
      UPDATE stored_graphs 
      SET status = ?, approved_by = ?, approval_note = ?, updated_at = ?
      WHERE id = ?
    `,
      input.status,
      input.approvedBy || null,
      input.approvalNote || null,
      now,
      input.id
    );
    
    const result = await this.findById(input.id);
    if (!result) {
      throw new Error(`Graph not found: ${input.id}`);
    }
    return result;
  }

  async updatePromptEmbedding(id: string, embedding: Buffer): Promise<StoredGraph> {
    const db = await getGraphDatabase();
    const now = Date.now();
    
    await db.run(`
      UPDATE stored_graphs 
      SET prompt_embedding = ?, updated_at = ?
      WHERE id = ?
    `, embedding, now, id);
    
    const result = await this.findById(id);
    if (!result) {
      throw new Error(`Graph not found: ${id}`);
    }
    return result;
  }

  async incrementUsage(id: string): Promise<void> {
    const db = await getGraphDatabase();
    const now = Date.now();
    
    await db.run(`
      UPDATE stored_graphs 
      SET execution_count = execution_count + 1, 
          last_used_at = ?,
          updated_at = ?
      WHERE id = ?
    `, now, now, id);
  }

  async query(params: StoreQuery): Promise<StoredGraph[]> {
    const db = await getGraphDatabase();
    let sql = `
      SELECT 
        id, prompt, graph_json, intent_json, status, created_at, updated_at,
        generation_ms, execution_ms, execution_count, last_used_at,
        approved_by, approval_note, node_count, success, error_message, prompt_embedding
      FROM stored_graphs
    `;
    
    const sqlParams: any[] = [];
    
    // Build WHERE clause
    const whereConditions: string[] = [];
    
    if (params.status) {
      whereConditions.push('status = ?');
      sqlParams.push(params.status);
    }
    
    if (params.promptContains) {
      whereConditions.push(`
        rowid IN (
          SELECT rowid FROM stored_graphs_fts 
          WHERE stored_graphs_fts MATCH ?
        )
      `);
      sqlParams.push(params.promptContains);
    }
    
    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Add ORDER BY
    sql += ' ORDER BY created_at DESC';
    
    // Add LIMIT and OFFSET
    if (params.limit !== undefined) {
      sql += ' LIMIT ?';
      sqlParams.push(params.limit);
    }
    
    if (params.offset !== undefined) {
      sql += ' OFFSET ?';
      sqlParams.push(params.offset);
    }
    
    const rows = await db.all(sql, ...sqlParams);
    
    return rows.map((row: any) => this.toStoredGraph(row));
  }

  async stats(): Promise<{ total: number, byStatus: Record<GraphStatus, number> }> {
    const db = await getGraphDatabase();
    const rows = await db.all(`
      SELECT status, COUNT(*) as count
      FROM stored_graphs
      GROUP BY status
    `) as { status: GraphStatus; count: number }[];
    
    const byStatus: Record<GraphStatus, number> = {
      draft: 0,
      approved: 0,
      rejected: 0,
      deprecated: 0
    };
    
    let total = 0;
    for (const row of rows) {
      byStatus[row.status] = row.count;
      total += row.count;
    }
    
    return { total, byStatus };
  }

  // Helper: Maps snake_case DB columns to camelCase StoredGraph fields
  private toStoredGraph(row: any): StoredGraph {
    return {
      id: row.id,
      prompt: row.prompt,
      graphJson: row.graph_json,
      intentJson: row.intent_json || null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      generationMs: row.generation_ms,
      executionMs: row.execution_ms,
      executionCount: row.execution_count,
      lastUsedAt: row.last_used_at,
      approvedBy: row.approved_by,
      approvalNote: row.approval_note,
      nodeCount: row.node_count,
      success: row.success === 1, // Convert SQLite integer boolean
      errorMessage: row.error_message,
      promptEmbedding: row.prompt_embedding || null
    };
  }
}
