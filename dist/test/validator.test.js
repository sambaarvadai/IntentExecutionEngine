"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test/validator.test.ts
// Note: These tests require Jest to be installed: npm install --save-dev jest @types/jest
const plans_1 = require("../plans");
describe('validatePlan', () => {
    it('returns valid for a well-formed plan', () => {
        const result = (0, plans_1.validatePlan)({ needsDb: true, entity: 'customers', select: ['customers.*'] });
        expect(result.valid).toBe(true);
    });
    it('returns error for missing entity', () => {
        const result = (0, plans_1.validatePlan)({ needsDb: true });
        expect(result.valid).toBe(false);
        expect(result.issues.some(i => i.field === 'entity')).toBe(true);
    });
    it('returns error for unknown table', () => {
        const result = (0, plans_1.validatePlan)({ needsDb: true, entity: 'nonexistent_table' });
        expect(result.valid).toBe(false);
    });
    it('returns error for disallowed operator', () => {
        const result = (0, plans_1.validatePlan)({
            needsDb: true,
            entity: 'customers',
            where: [{ field: 'customers.name', op: 'DROP', value: 'x' }]
        });
        expect(result.valid).toBe(false);
    });
    it('produces llmFeedback on invalid plan', () => {
        const result = (0, plans_1.validatePlan)({ needsDb: true });
        expect(result.llmFeedback).toBeDefined();
        expect(result.llmFeedback).toContain('ERRORS');
    });
});
//# sourceMappingURL=validator.test.js.map