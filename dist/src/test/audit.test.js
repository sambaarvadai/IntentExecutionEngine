"use strict";
// Final fixed version of audit.test.ts - local instance and proper imports
Object.defineProperty(exports, "__esModule", { value: true });
const audit_1 = require("../api/audit");
describe('AuditLog', () => {
    let auditLog;
    beforeEach(() => {
        auditLog = new audit_1.AuditLog();
    });
    describe('log', () => {
        it('stores entry with correct fields', () => {
            const entry = {
                requestId: 'req-123',
                timestamp: new Date('2023-01-01T10:00:00Z'),
                userId: 'user-456',
                apiId: 'api-789',
                planId: 'plan-012',
                route: '/customers',
                method: 'GET',
                paramKeys: ['id', 'name'],
                resultRowCount: 5,
                executionTimeMs: 150,
                status: 'success'
            };
            auditLog.log(entry);
            const query = auditLog.query({ apiId: 'api-789' });
            expect(query).toHaveLength(1);
            expect(query[0]).toMatchObject(entry);
        });
        it('paramKeys contains param names not values', () => {
            const entry = {
                requestId: 'req-456',
                timestamp: new Date('2023-01-01T11:00:00Z'),
                apiId: 'api-123',
                planId: 'plan-456',
                route: '/search',
                method: 'POST',
                paramKeys: ['query', 'limit'],
                resultRowCount: 10,
                executionTimeMs: 200,
                status: 'success'
            };
            auditLog.log(entry);
            const query = auditLog.query({ apiId: 'api-123' });
            expect(query).toHaveLength(1);
            expect(query[0].paramKeys).toEqual(['query', 'limit']);
            expect(query[0].paramKeys).not.toContain('search term');
        });
    });
    describe('query', () => {
        beforeEach(() => {
            // Add some test entries
            auditLog.log({
                requestId: 'req-1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
                userId: 'user-456',
                apiId: 'api-1',
                planId: 'plan-1',
                route: '/users',
                method: 'GET',
                paramKeys: ['id'],
                resultRowCount: 10,
                executionTimeMs: 100,
                status: 'success'
            });
            auditLog.log({
                requestId: 'req-2',
                timestamp: new Date('2023-01-01T11:00:00Z'),
                userId: 'user-456',
                apiId: 'api-2',
                planId: 'plan-2',
                route: '/orders',
                method: 'POST',
                paramKeys: ['data'],
                resultRowCount: 5,
                executionTimeMs: 200,
                status: 'error',
                errorCode: 'VALIDATION_ERROR'
            });
        });
        it('filters by apiId', () => {
            const results = auditLog.query({ apiId: 'api-1' });
            expect(results).toHaveLength(1); // only one entry for api-1
            expect(results.every(r => r.apiId === 'api-1')).toBe(true);
        });
        it('filters by userId', () => {
            auditLog.log({
                requestId: 'req-4',
                timestamp: new Date('2023-01-01T13:00:00Z'),
                userId: 'user-789',
                apiId: 'api-3',
                planId: 'plan-3',
                route: '/profile',
                method: 'GET',
                paramKeys: ['id'],
                resultRowCount: 1,
                executionTimeMs: 50,
                status: 'success'
            });
            const results = auditLog.query({ userId: 'user-789' });
            expect(results).toHaveLength(1);
            expect(results[0].userId).toBe('user-789');
        });
        it('filters by status', () => {
            const results = auditLog.query({ status: 'error' });
            expect(results).toHaveLength(1);
            expect(results[0].status).toBe('error');
            expect(results[0].errorCode).toBe('VALIDATION_ERROR');
        });
        it('filters by since date', () => {
            const since = new Date('2023-01-01T12:00:00Z');
            const results = auditLog.query({ since });
            // Should only include entries after the since date
            expect(results.every(r => r.timestamp >= since)).toBe(true);
        });
        it('applies limit', () => {
            const results = auditLog.query({ limit: 2 });
            expect(results).toHaveLength(2);
        });
    });
    describe('getSummary', () => {
        beforeEach(() => {
            auditLog.clear();
            auditLog.log({
                requestId: 'req-1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
                apiId: 'api-summary',
                planId: 'plan-1',
                route: '/test',
                method: 'GET',
                paramKeys: ['id'],
                resultRowCount: 10,
                executionTimeMs: 100,
                status: 'success'
            });
            auditLog.log({
                requestId: 'req-2',
                timestamp: new Date('2023-01-01T11:00:00Z'),
                apiId: 'api-summary',
                planId: 'plan-2',
                route: '/test',
                method: 'POST',
                paramKeys: ['data'],
                resultRowCount: 20,
                executionTimeMs: 200,
                status: 'error'
            });
            auditLog.log({
                requestId: 'req-3',
                timestamp: new Date('2023-01-01T12:30:00Z'),
                apiId: 'api-summary',
                planId: 'plan-3',
                route: '/test',
                method: 'GET',
                paramKeys: [],
                resultRowCount: 15,
                executionTimeMs: 150,
                status: 'blocked'
            });
        });
        it('returns correct counts', () => {
            const summary = auditLog.getSummary('api-summary');
            expect(summary.totalRequests).toBe(3);
            expect(summary.successCount).toBe(1);
            expect(summary.errorCount).toBe(1);
            expect(summary.blockedCount).toBe(1);
        });
        it('calculates avgExecutionTimeMs correctly', () => {
            const summary = auditLog.getSummary('api-summary');
            // (100 + 200 + 150) / 3 = 150
            expect(summary.avgExecutionTimeMs).toBe(150);
        });
        it('lastCalledAt is most recent entry', () => {
            const summary = auditLog.getSummary('api-summary');
            expect(summary.lastCalledAt).toBeInstanceOf(Date);
            // Should be the timestamp of the most recent entry
        });
        it('handles empty API correctly', () => {
            const summary = auditLog.getSummary('nonexistent-api');
            expect(summary.totalRequests).toBe(0);
            expect(summary.successCount).toBe(0);
            expect(summary.errorCount).toBe(0);
            expect(summary.blockedCount).toBe(0);
            expect(summary.avgExecutionTimeMs).toBe(0);
            expect(summary.lastCalledAt).toBeUndefined();
        });
    });
    describe('clear', () => {
        it('empties all entries', () => {
            auditLog.log({
                requestId: 'req-1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
                apiId: 'api-1',
                planId: 'plan-1',
                route: '/test',
                method: 'GET',
                paramKeys: ['id'],
                resultRowCount: 10,
                executionTimeMs: 100,
                status: 'success'
            });
            expect(auditLog.query({})).toHaveLength(1);
            auditLog.clear();
            expect(auditLog.query({})).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=audit.test.js.map