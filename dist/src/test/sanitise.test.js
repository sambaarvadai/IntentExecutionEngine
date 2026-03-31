"use strict";
// Final fixed version of sanitise.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const sanitise_1 = require("../api/sanitise");
const types_1 = require("../context/types");
describe('Sanitisation Functions', () => {
    describe('sanitiseString', () => {
        it('returns trimmed string by default', () => {
            const result = (0, sanitise_1.sanitiseString)('  hello world  ');
            expect(result).toBe('hello world');
        });
        it('strips HTML chars by default', () => {
            const result = (0, sanitise_1.sanitiseString)('<script>alert("x")</script>');
            expect(result).toBe('scriptalert(x)/script');
        });
        it('truncates to maxLength', () => {
            const result = (0, sanitise_1.sanitiseString)('very long string', { maxLength: 5 });
            expect(result).toBe('very ');
        });
        it('throws SanitisationError for non-string', () => {
            expect(() => (0, sanitise_1.sanitiseString)(123)).toThrow(types_1.SanitisationError);
        });
        it('throws SanitisationError for empty after sanitisation', () => {
            expect(() => (0, sanitise_1.sanitiseString)('')).toThrow(types_1.SanitisationError);
        });
        it('allows HTML when allowHtml: true', () => {
            const result = (0, sanitise_1.sanitiseString)('<div>content</div>', { allowHtml: true });
            expect(result).toBe('<div>content</div>');
        });
    });
    describe('sanitiseNumber', () => {
        it('parses string numbers', () => {
            const result = (0, sanitise_1.sanitiseNumber)('42');
            expect(result).toBe(42);
        });
        it('throws on NaN', () => {
            expect(() => (0, sanitise_1.sanitiseNumber)('not a number')).toThrow(types_1.SanitisationError);
        });
        it('throws below min', () => {
            expect(() => (0, sanitise_1.sanitiseNumber)(5, { min: 10 })).toThrow(types_1.SanitisationError);
        });
        it('throws above max', () => {
            expect(() => (0, sanitise_1.sanitiseNumber)(150, { max: 100 })).toThrow(types_1.SanitisationError);
        });
        it('throws on non-integer when integer: true', () => {
            expect(() => (0, sanitise_1.sanitiseNumber)(3.14, { integer: true })).toThrow(types_1.SanitisationError);
        });
        it('accepts valid integer', () => {
            const result = (0, sanitise_1.sanitiseNumber)(42, { integer: true });
            expect(result).toBe(42);
        });
    });
    describe('sanitiseBoolean', () => {
        it('true, "true", 1, "1" all return true', () => {
            expect((0, sanitise_1.sanitiseBoolean)(true)).toBe(true);
            expect((0, sanitise_1.sanitiseBoolean)('true')).toBe(true);
            expect((0, sanitise_1.sanitiseBoolean)(1)).toBe(true);
            expect((0, sanitise_1.sanitiseBoolean)('1')).toBe(true);
        });
        it('false, "false", 0, "0" all return false', () => {
            expect((0, sanitise_1.sanitiseBoolean)(false)).toBe(false);
            expect((0, sanitise_1.sanitiseBoolean)('false')).toBe(false);
            expect((0, sanitise_1.sanitiseBoolean)(0)).toBe(false);
            expect((0, sanitise_1.sanitiseBoolean)('0')).toBe(false);
        });
        it('throws on "yes", null, undefined', () => {
            expect(() => (0, sanitise_1.sanitiseBoolean)('yes')).toThrow(types_1.SanitisationError);
            expect(() => (0, sanitise_1.sanitiseBoolean)(null)).toThrow(types_1.SanitisationError);
            expect(() => (0, sanitise_1.sanitiseBoolean)(undefined)).toThrow(types_1.SanitisationError);
        });
    });
    describe('sanitiseArray', () => {
        it('returns array unchanged', () => {
            const input = [1, 2, 3];
            const result = (0, sanitise_1.sanitiseArray)(input);
            expect(result).toEqual(input);
        });
        it('throws on non-array', () => {
            expect(() => (0, sanitise_1.sanitiseArray)('not an array')).toThrow(types_1.SanitisationError);
        });
        it('throws when exceeds maxItems', () => {
            const input = new Array(200).fill(0);
            expect(() => (0, sanitise_1.sanitiseArray)(input, { maxItems: 100 })).toThrow(types_1.SanitisationError);
        });
        it('applies itemSanitiser to each element', () => {
            const input = ['1', '2', '3'];
            const result = (0, sanitise_1.sanitiseArray)(input, {
                itemSanitiser: (item) => parseInt(String(item))
            });
            expect(result).toEqual([1, 2, 3]);
        });
    });
    describe('sanitiseParams', () => {
        it('sanitises all required params', () => {
            const params = {
                name: 'John',
                age: '25',
                active: 'true'
            };
            const definitions = [
                { name: 'name', type: 'string', required: true },
                { name: 'age', type: 'number', required: true },
                { name: 'active', type: 'boolean', required: true }
            ];
            const result = (0, sanitise_1.sanitiseParams)(params, definitions);
            expect(result.name).toBe('John');
            expect(result.age).toBe(25);
            expect(result.active).toBe(true);
        });
        it('skips absent optional params', () => {
            const params = { name: 'John' };
            const definitions = [
                { name: 'name', type: 'string', required: true },
                { name: 'optional', type: 'string', required: false }
            ];
            const result = (0, sanitise_1.sanitiseParams)(params, definitions);
            expect(result.name).toBe('John');
            expect(result.optional).toBeUndefined();
        });
        it('throws SanitisationError with field name on failure', () => {
            const params = { age: 'not a number' };
            const definitions = [
                { name: 'age', type: 'number', required: true }
            ];
            expect(() => (0, sanitise_1.sanitiseParams)(params, definitions)).toThrow(types_1.SanitisationError);
        });
        it('uses default values when provided', () => {
            const params = { name: 'John' };
            const definitions = [
                { name: 'name', type: 'string', required: true },
                { name: 'limit', type: 'number', required: false, default: 10 }
            ];
            const result = (0, sanitise_1.sanitiseParams)(params, definitions);
            expect(result.name).toBe('John');
            expect(result.limit).toBe(10);
        });
    });
});
//# sourceMappingURL=sanitise.test.js.map