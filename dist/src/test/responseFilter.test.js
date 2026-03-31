"use strict";
// src/test/responseFilter.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const responseFilter_1 = require("../api/responseFilter");
describe('Response Filtering', () => {
    const sampleData = {
        rows: [
            { id: 1, name: 'Ravi', email: 'ravi@test.com', salary: 50000 },
            { id: 2, name: 'Priya', email: 'priya@test.com', salary: 60000 }
        ],
        fields: ['id', 'name', 'email', 'salary']
    };
    describe('filterResponse', () => {
        it('public label returns data unchanged for any role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'public',
                userRoles: ['guest']
            });
            expect(result).toEqual(sampleData);
        });
        it('internal label allows admin role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'internal',
                userRoles: ['admin']
            });
            expect(result).toEqual(sampleData);
        });
        it('internal label allows analyst role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'internal',
                userRoles: ['analyst']
            });
            expect(result).toEqual(sampleData);
        });
        it('internal label blocks guest role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'internal',
                userRoles: ['guest']
            });
            expect(result).toEqual({
                filtered: true,
                reason: 'insufficient_role'
            });
        });
        it('internal label strips sensitiveFields when provided', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'internal',
                userRoles: ['admin'],
                sensitiveFields: ['salary']
            });
            const expected = {
                rows: [
                    { id: 1, name: 'Ravi', email: 'ravi@test.com' },
                    { id: 2, name: 'Priya', email: 'priya@test.com' }
                ],
                fields: ['id', 'name', 'email', 'salary']
            };
            expect(result).toEqual(expected);
        });
        it('sensitive label allows admin role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'sensitive',
                userRoles: ['admin']
            });
            expect(result).toEqual(sampleData);
        });
        it('sensitive label allows data-officer role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'sensitive',
                userRoles: ['data-officer']
            });
            expect(result).toEqual(sampleData);
        });
        it('sensitive label blocks analyst role', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'sensitive',
                userRoles: ['analyst']
            });
            expect(result).toEqual({
                filtered: true,
                reason: 'insufficient_role'
            });
        });
        it('sensitive label strips sensitiveFields', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'sensitive',
                userRoles: ['admin'],
                sensitiveFields: ['salary']
            });
            const expected = {
                rows: [
                    { id: 1, name: 'Ravi', email: 'ravi@test.com' },
                    { id: 2, name: 'Priya', email: 'priya@test.com' }
                ],
                fields: ['id', 'name', 'email', 'salary']
            };
            expect(result).toEqual(expected);
        });
        it('restricted label allows admin only', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'restricted',
                userRoles: ['admin']
            });
            expect(result).toEqual(sampleData);
        });
        it('restricted label blocks data-officer', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'restricted',
                userRoles: ['data-officer']
            });
            expect(result).toEqual({
                filtered: true,
                reason: 'insufficient_role'
            });
        });
        it('restricted label blocks analyst', () => {
            const result = (0, responseFilter_1.filterResponse)(sampleData, {
                label: 'restricted',
                userRoles: ['analyst']
            });
            expect(result).toEqual({
                filtered: true,
                reason: 'insufficient_role'
            });
        });
    });
    describe('stripFields', () => {
        it('strips fields from rows in { rows: [...] } shape', () => {
            const data = {
                rows: [
                    { id: 1, name: 'John', email: 'john@test.com', salary: 50000 },
                    { id: 2, name: 'Jane', email: 'jane@test.com', salary: 60000 }
                ]
            };
            const result = (0, responseFilter_1.stripFields)(data, ['salary']);
            const expected = {
                rows: [
                    { id: 1, name: 'John', email: 'john@test.com' },
                    { id: 2, name: 'Jane', email: 'jane@test.com' }
                ]
            };
            expect(result).toEqual(expected);
        });
        it('strips fields from plain array', () => {
            const data = [
                { id: 1, name: 'John', email: 'john@test.com', salary: 50000 },
                { id: 2, name: 'Jane', email: 'jane@test.com', salary: 60000 }
            ];
            const result = (0, responseFilter_1.stripFields)(data, ['salary']);
            const expected = [
                { id: 1, name: 'John', email: 'john@test.com' },
                { id: 2, name: 'Jane', email: 'jane@test.com' }
            ];
            expect(result).toEqual(expected);
        });
        it('strips fields from plain object', () => {
            const data = {
                id: 1,
                name: 'John',
                email: 'john@test.com',
                salary: 50000
            };
            const result = (0, responseFilter_1.stripFields)(data, ['salary']);
            const expected = {
                id: 1,
                name: 'John',
                email: 'john@test.com'
            };
            expect(result).toEqual(expected);
        });
        it('does not mutate original data', () => {
            const originalData = {
                rows: [
                    { id: 1, name: 'John', email: 'john@test.com', salary: 50000 }
                ]
            };
            const originalString = JSON.stringify(originalData);
            (0, responseFilter_1.stripFields)(originalData, ['salary']);
            expect(JSON.stringify(originalData)).toBe(originalString);
        });
        it('handles empty fields array', () => {
            const data = {
                rows: [
                    { id: 1, name: 'John', email: 'john@test.com', salary: 50000 }
                ]
            };
            const result = (0, responseFilter_1.stripFields)(data, []);
            expect(result).toEqual(data);
        });
    });
});
//# sourceMappingURL=responseFilter.test.js.map