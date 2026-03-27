/**
 * In-memory audit log implementation for API monitoring and compliance
 */
export interface AuditEntry {
    requestId: string;
    timestamp: Date;
    userId?: string;
    apiId: string;
    planId: string;
    route: string;
    method: string;
    paramKeys: string[];
    resultRowCount: number;
    executionTimeMs: number;
    status: 'success' | 'error' | 'blocked';
    errorCode?: string;
    ipAddress?: string;
}
export interface IntentAuditEntry {
    requestId: string;
    timestamp: Date;
    userId?: string;
    prompt: string;
    graphId: string;
    nodeCount: number;
    generationMs: number;
    executionMs: number;
    totalMs: number;
    status: 'success' | 'error' | 'parse_error';
    errorMessage?: string;
    correctionAttempts: number;
    dryRun: boolean;
}
export declare class AuditLog {
    private readonly entries;
    /**
     * Log an audit entry
     */
    log(entry: AuditEntry): void;
    /**
     * Query audit entries with filters
     */
    query(filter: {
        apiId?: string;
        userId?: string;
        status?: AuditEntry['status'];
        since?: Date;
        limit?: number;
    }): AuditEntry[];
    /**
     * Get summary statistics for a specific API
     */
    getSummary(apiId: string): {
        totalRequests: number;
        successCount: number;
        errorCount: number;
        blockedCount: number;
        avgExecutionTimeMs: number;
        lastCalledAt?: Date;
    };
    /**
     * Clear all audit entries (for testing)
     */
    clear(): void;
}
export declare class IntentAuditLog {
    private readonly entries;
    log(entry: IntentAuditEntry): void;
    query(filter: {
        userId?: string;
        status?: IntentAuditEntry['status'];
        since?: Date;
        dryRun?: boolean;
        limit?: number;
    }): IntentAuditEntry[];
    getSummary(): {
        totalRequests: number;
        successCount: number;
        errorCount: number;
        parseErrorCount: number;
        avgGenerationMs: number;
        avgExecutionMs: number;
        avgCorrectionAttempts: number;
    };
    clear(): void;
}
export declare const auditLog: AuditLog;
export declare const intentAuditLog: IntentAuditLog;
//# sourceMappingURL=audit.d.ts.map