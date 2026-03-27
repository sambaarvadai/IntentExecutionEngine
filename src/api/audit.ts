// src/api/audit.ts

import { DataAccessLabel } from '../context/types'

/**
 * In-memory audit log implementation for API monitoring and compliance
 */

export interface AuditEntry {
  requestId: string
  timestamp: Date
  userId?: string
  apiId: string
  planId: string
  route: string
  method: string
  paramKeys: string[]       // param names only, never values
  resultRowCount: number     // shape not content
  executionTimeMs: number
  status: 'success' | 'error' | 'blocked'
  errorCode?: string
  ipAddress?: string        // optional, from request context
}

export interface IntentAuditEntry {
  requestId: string
  timestamp: Date
  userId?: string
  prompt: string              // the natural language input
  graphId: string             // ExecutionGraph.id
  nodeCount: number           // graph.nodes.length
  generationMs: number        // LLM generation time
  executionMs: number         // graph execution time
  totalMs: number             // generationMs + executionMs
  status: 'success' | 'error' | 'parse_error'
  errorMessage?: string       // if status is error or parse_error
  correctionAttempts: number  // how many self-correction retries fired (0 if none)
  dryRun: boolean
}

export class AuditLog {
  private readonly entries: AuditEntry[] = []

  /**
   * Log an audit entry
   */
  log(entry: AuditEntry): void {
    const logEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date()
    }

    this.entries.push(logEntry)

    // Console output with structured format
    console.log(
      `[AUDIT] ${entry.status} | ${entry.method} ${entry.route} | ` +
      `user:${entry.userId ?? 'anon'} | ` +
      `rows:${entry.resultRowCount} | ${entry.executionTimeMs}ms | ` +
      `req:${entry.requestId}`
    )
  }

  /**
   * Query audit entries with filters
   */
  query(filter: {
    apiId?: string
    userId?: string
    status?: AuditEntry['status']
    since?: Date
    limit?: number           // default 100
  }): AuditEntry[] {
    let filtered = [...this.entries]

    // Apply filters
    if (filter.apiId) {
      filtered = filtered.filter(entry => entry.apiId === filter.apiId)
    }
    if (filter.userId) {
      filtered = filtered.filter(entry => entry.userId === filter.userId)
    }
    if (filter.status) {
      filtered = filtered.filter(entry => entry.status === filter.status)
    }
    if (filter.since) {
      filtered = filtered.filter(entry => entry.timestamp >= filter.since!)
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply limit
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit)
    }

    return filtered
  }

  /**
   * Get summary statistics for a specific API
   */
  getSummary(apiId: string): {
    totalRequests: number
    successCount: number
    errorCount: number
    blockedCount: number
    avgExecutionTimeMs: number
    lastCalledAt?: Date
  } {
    const apiEntries = this.entries.filter(entry => entry.apiId === apiId)
    
    if (apiEntries.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        blockedCount: 0,
        avgExecutionTimeMs: 0
      }
    }

    const totalRequests = apiEntries.length
    const successCount = apiEntries.filter(entry => entry.status === 'success').length
    const errorCount = apiEntries.filter(entry => entry.status === 'error').length
    const blockedCount = apiEntries.filter(entry => entry.status === 'blocked').length
    const avgExecutionTime = totalRequests > 0 
      ? apiEntries.reduce((sum, entry) => sum + entry.executionTimeMs, 0) / totalRequests 
      : 0

    return {
      totalRequests,
      successCount,
      errorCount,
      blockedCount,
      avgExecutionTimeMs: avgExecutionTime,
      lastCalledAt: new Date(Math.max(...apiEntries.map(e => e.timestamp.getTime())))
    }
  }

  /**
   * Clear all audit entries (for testing)
   */
  clear(): void {
    this.entries.length = 0
  }
}

export class IntentAuditLog {
  private readonly entries: IntentAuditEntry[] = []

  log(entry: IntentAuditEntry): void {
    const logEntry = { ...entry, timestamp: entry.timestamp || new Date() }
    this.entries.push(logEntry)
    
    console.log(
      `[INTENT] ${entry.status} | ` +
      `graph:${entry.graphId} | ` +
      `nodes:${entry.nodeCount} | ` +
      `user:${entry.userId ?? 'anon'} | ` +
      `gen:${entry.generationMs}ms exec:${entry.executionMs}ms | ` +
      `corrections:${entry.correctionAttempts} | ` +
      `req:${entry.requestId}` 
    )
  }

  query(filter: {
    userId?: string
    status?: IntentAuditEntry['status']
    since?: Date
    dryRun?: boolean
    limit?: number
  }): IntentAuditEntry[] {
    let filtered = [...this.entries]

    if (filter.userId)
      filtered = filtered.filter(e => e.userId === filter.userId)
    if (filter.status)
      filtered = filtered.filter(e => e.status === filter.status)
    if (filter.since)
      filtered = filtered.filter(e => e.timestamp >= filter.since!)
    if (filter.dryRun !== undefined)
      filtered = filtered.filter(e => e.dryRun === filter.dryRun)

    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (filter.limit)
      filtered = filtered.slice(0, filter.limit)

    return filtered
  }

  getSummary(): {
    totalRequests: number
    successCount: number
    errorCount: number
    parseErrorCount: number
    avgGenerationMs: number
    avgExecutionMs: number
    avgCorrectionAttempts: number
  } {
    const total = this.entries.length
    if (total === 0) return {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      parseErrorCount: 0,
      avgGenerationMs: 0,
      avgExecutionMs: 0,
      avgCorrectionAttempts: 0
    }

    return {
      totalRequests: total,
      successCount: this.entries.filter(e => e.status === 'success').length,
      errorCount: this.entries.filter(e => e.status === 'error').length,
      parseErrorCount: this.entries.filter(e => e.status === 'parse_error').length,
      avgGenerationMs: this.entries.reduce((s, e) => s + e.generationMs, 0) / total,
      avgExecutionMs: this.entries.reduce((s, e) => s + e.executionMs, 0) / total,
      avgCorrectionAttempts: this.entries.reduce((s, e) => s + e.correctionAttempts, 0) / total
    }
  }

  clear(): void {
    this.entries.length = 0
  }
}

// Export singleton instance
export const auditLog = new AuditLog()
export const intentAuditLog = new IntentAuditLog()
