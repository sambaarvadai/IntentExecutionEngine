"use strict";
// ------------------------------------------------------------------
// Test Setup
// ------------------------------------------------------------------
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';
// Override debug flag for cleaner test output
process.env.DEBUG = 'false';
// Mock console methods to reduce noise in test output
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
// Mock database module
jest.mock('../db/sqlite', () => ({
    getDatabase: jest.fn(() => Promise.resolve({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
        close: jest.fn()
    }))
}));
// Mock LLM module
jest.mock('../plans/anthropicAdapter', () => ({
    AnthropicAdapter: jest.fn().mockImplementation(() => ({
        generatePlan: jest.fn().mockResolvedValue({
            id: 'test-plan',
            needsDb: true,
            entity: 'customers',
            select: ['customers.*']
        }),
        correctPlan: jest.fn().mockResolvedValue({
            id: 'test-plan-corrected',
            needsDb: true,
            entity: 'customers',
            select: ['customers.*', 'orders.*']
        })
    }))
}));
// Mock config module
jest.mock('../config', () => ({
    config: {
        database: {
            path: ':memory:',
            timeout: 10000
        },
        llm: {
            model: 'claude-3-haiku-20240307',
            maxTokens: 1000
        }
    }
}));
// Mock schema metadata module
jest.mock('../schema/metadata', () => ({
    getSchemaMetadata: jest.fn().mockResolvedValue({
        tables: [
            {
                name: 'customers',
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false },
                    { name: 'name', type: 'TEXT', nullable: false },
                    { name: 'city', type: 'TEXT', nullable: false },
                    { name: 'score', type: 'INTEGER', nullable: true }
                ]
            },
            {
                name: 'orders',
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false },
                    { name: 'customer_id', type: 'INTEGER', nullable: false },
                    { name: 'amount', type: 'REAL', nullable: false },
                    { name: 'created_at', type: 'TEXT', nullable: false }
                ]
            }
        ],
        allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
        allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN'],
        maxLimit: 100
    })
}));
//# sourceMappingURL=setup.js.map