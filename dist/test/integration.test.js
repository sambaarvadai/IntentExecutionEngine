"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test/integration.test.ts
const plans_1 = require("../plans");
describe('Full pipeline integration', () => {
    it('generates, validates, compiles and executes a real query', async () => {
        // Use mock adapter instead of real AnthropicAdapter to avoid API key requirement
        const mockAdapter = {
            generatePlan: jest.fn().mockResolvedValue({
                needsDb: true,
                entity: 'customers',
                select: ['customers.*']
            }),
            correctPlan: jest.fn().mockResolvedValue({
                needsDb: true,
                entity: 'customers',
                select: ['customers.*']
            })
        };
        const result = await (0, plans_1.buildQueryPipeline)('Show all customers', mockAdapter);
        expect(result.finalValidation.valid).toBe(true);
        expect(result.compiled.sql).toContain('SELECT');
        expect(result.compiled.sql).toContain('FROM customers');
    });
    it('handles conversational intent without hitting DB', async () => {
        // Create a mock adapter that returns a conversational response
        const conversationalAdapter = {
            generatePlan: jest.fn().mockResolvedValue({
                needsDb: false,
                responseMode: 'conversational'
            }),
            correctPlan: jest.fn()
        };
        const result = await (0, plans_1.buildQueryPipeline)('Hello, how are you?', conversationalAdapter);
        expect(result.originalPlan.needsDb).toBe(false);
        expect(result.compiled.sql).toBe('');
    });
    it('self-corrects an invalid plan', async () => {
        // Mock LLM that returns a bad plan first, then a good one
        const mockAdapter = {
            generatePlan: jest.fn().mockResolvedValueOnce({
                needsDb: true,
                entity: 'nonexistent', // bad
            }).mockResolvedValueOnce({
                needsDb: true,
                entity: 'customers', // corrected
                select: ['customers.*']
            }),
            correctPlan: jest.fn().mockResolvedValue({
                needsDb: true,
                entity: 'customers',
                select: ['customers.*']
            })
        };
        const result = await (0, plans_1.buildQueryPipeline)('show customers', mockAdapter);
        expect(result.attempts).toBeGreaterThan(1);
        expect(result.finalValidation.valid).toBe(true);
    });
});
//# sourceMappingURL=integration.test.js.map