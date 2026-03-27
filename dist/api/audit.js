"use strict";
// src/api/audit.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentAuditLog = exports.auditLog = exports.IntentAuditLog = exports.AuditLog = void 0;
class AuditLog {
    constructor() {
        this.entries = [];
    }
    /**
     * Log an audit entry
     */
    log(entry) {
        const logEntry = {
            ...entry,
            timestamp: entry.timestamp || new Date()
        };
        this.entries.push(logEntry);
        // Console output with structured format
        console.log(`[AUDIT] ${entry.status} | ${entry.method} ${entry.route} | ` +
            `user:${entry.userId ?? 'anon'} | ` +
            `rows:${entry.resultRowCount} | ${entry.executionTimeMs}ms | ` +
            `req:${entry.requestId}`);
    }
    /**
     * Query audit entries with filters
     */
    query(filter) {
        let filtered = [...this.entries];
        // Apply filters
        if (filter.apiId) {
            filtered = filtered.filter(entry => entry.apiId === filter.apiId);
        }
        if (filter.userId) {
            filtered = filtered.filter(entry => entry.userId === filter.userId);
        }
        if (filter.status) {
            filtered = filtered.filter(entry => entry.status === filter.status);
        }
        if (filter.since) {
            filtered = filtered.filter(entry => entry.timestamp >= filter.since);
        }
        // Sort by timestamp descending (newest first)
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (filter.limit) {
            filtered = filtered.slice(0, filter.limit);
        }
        return filtered;
    }
    /**
     * Get summary statistics for a specific API
     */
    getSummary(apiId) {
        const apiEntries = this.entries.filter(entry => entry.apiId === apiId);
        if (apiEntries.length === 0) {
            return {
                totalRequests: 0,
                successCount: 0,
                errorCount: 0,
                blockedCount: 0,
                avgExecutionTimeMs: 0
            };
        }
        const totalRequests = apiEntries.length;
        const successCount = apiEntries.filter(entry => entry.status === 'success').length;
        const errorCount = apiEntries.filter(entry => entry.status === 'error').length;
        const blockedCount = apiEntries.filter(entry => entry.status === 'blocked').length;
        const avgExecutionTime = totalRequests > 0
            ? apiEntries.reduce((sum, entry) => sum + entry.executionTimeMs, 0) / totalRequests
            : 0;
        return {
            totalRequests,
            successCount,
            errorCount,
            blockedCount,
            avgExecutionTimeMs: avgExecutionTime,
            lastCalledAt: new Date(Math.max(...apiEntries.map(e => e.timestamp.getTime())))
        };
    }
    /**
     * Clear all audit entries (for testing)
     */
    clear() {
        this.entries.length = 0;
    }
}
exports.AuditLog = AuditLog;
class IntentAuditLog {
    constructor() {
        this.entries = [];
    }
    log(entry) {
        const logEntry = { ...entry, timestamp: entry.timestamp || new Date() };
        this.entries.push(logEntry);
        console.log(`[INTENT] ${entry.status} | ` +
            `graph:${entry.graphId} | ` +
            `nodes:${entry.nodeCount} | ` +
            `user:${entry.userId ?? 'anon'} | ` +
            `gen:${entry.generationMs}ms exec:${entry.executionMs}ms | ` +
            `corrections:${entry.correctionAttempts} | ` +
            `req:${entry.requestId}`);
    }
    query(filter) {
        let filtered = [...this.entries];
        if (filter.userId)
            filtered = filtered.filter(e => e.userId === filter.userId);
        if (filter.status)
            filtered = filtered.filter(e => e.status === filter.status);
        if (filter.since)
            filtered = filtered.filter(e => e.timestamp >= filter.since);
        if (filter.dryRun !== undefined)
            filtered = filtered.filter(e => e.dryRun === filter.dryRun);
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (filter.limit)
            filtered = filtered.slice(0, filter.limit);
        return filtered;
    }
    getSummary() {
        const total = this.entries.length;
        if (total === 0)
            return {
                totalRequests: 0,
                successCount: 0,
                errorCount: 0,
                parseErrorCount: 0,
                avgGenerationMs: 0,
                avgExecutionMs: 0,
                avgCorrectionAttempts: 0
            };
        return {
            totalRequests: total,
            successCount: this.entries.filter(e => e.status === 'success').length,
            errorCount: this.entries.filter(e => e.status === 'error').length,
            parseErrorCount: this.entries.filter(e => e.status === 'parse_error').length,
            avgGenerationMs: this.entries.reduce((s, e) => s + e.generationMs, 0) / total,
            avgExecutionMs: this.entries.reduce((s, e) => s + e.executionMs, 0) / total,
            avgCorrectionAttempts: this.entries.reduce((s, e) => s + e.correctionAttempts, 0) / total
        };
    }
    clear() {
        this.entries.length = 0;
    }
}
exports.IntentAuditLog = IntentAuditLog;
// Export singleton instance
exports.auditLog = new AuditLog();
exports.intentAuditLog = new IntentAuditLog();
//# sourceMappingURL=audit.js.map