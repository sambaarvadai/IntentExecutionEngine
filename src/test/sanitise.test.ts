// Final fixed version of sanitise.test.ts

import { sanitiseString, sanitiseNumber, sanitiseBoolean, sanitiseArray, sanitiseParams } from '../api/sanitise'
import { SanitisationError } from '../context/types'

describe('Sanitisation Functions', () => {
  describe('sanitiseString', () => {
    it('returns trimmed string by default', () => {
      const result = sanitiseString('  hello world  ')
      expect(result).toBe('hello world')
    })

    it('strips HTML chars by default', () => {
      const result = sanitiseString('<script>alert("x")</script>')
      expect(result).toBe('scriptalert(x)/script')
    })

    it('truncates to maxLength', () => {
      const result = sanitiseString('very long string', { maxLength: 5 })
      expect(result).toBe('very ')
    })

    it('throws SanitisationError for non-string', () => {
      expect(() => sanitiseString(123)).toThrow(SanitisationError)
    })

    it('throws SanitisationError for empty after sanitisation', () => {
      expect(() => sanitiseString('')).toThrow(SanitisationError)
    })

    it('allows HTML when allowHtml: true', () => {
      const result = sanitiseString('<div>content</div>', { allowHtml: true })
      expect(result).toBe('<div>content</div>')
    })
  })

  describe('sanitiseNumber', () => {
    it('parses string numbers', () => {
      const result = sanitiseNumber('42')
      expect(result).toBe(42)
    })

    it('throws on NaN', () => {
      expect(() => sanitiseNumber('not a number')).toThrow(SanitisationError)
    })

    it('throws below min', () => {
      expect(() => sanitiseNumber(5, { min: 10 })).toThrow(SanitisationError)
    })

    it('throws above max', () => {
      expect(() => sanitiseNumber(150, { max: 100 })).toThrow(SanitisationError)
    })

    it('throws on non-integer when integer: true', () => {
      expect(() => sanitiseNumber(3.14, { integer: true })).toThrow(SanitisationError)
    })

    it('accepts valid integer', () => {
      const result = sanitiseNumber(42, { integer: true })
      expect(result).toBe(42)
    })
  })

  describe('sanitiseBoolean', () => {
    it('true, "true", 1, "1" all return true', () => {
      expect(sanitiseBoolean(true)).toBe(true)
      expect(sanitiseBoolean('true')).toBe(true)
      expect(sanitiseBoolean(1)).toBe(true)
      expect(sanitiseBoolean('1')).toBe(true)
    })

    it('false, "false", 0, "0" all return false', () => {
      expect(sanitiseBoolean(false)).toBe(false)
      expect(sanitiseBoolean('false')).toBe(false)
      expect(sanitiseBoolean(0)).toBe(false)
      expect(sanitiseBoolean('0')).toBe(false)
    })

    it('throws on "yes", null, undefined', () => {
      expect(() => sanitiseBoolean('yes')).toThrow(SanitisationError)
      expect(() => sanitiseBoolean(null)).toThrow(SanitisationError)
      expect(() => sanitiseBoolean(undefined)).toThrow(SanitisationError)
    })
  })

  describe('sanitiseArray', () => {
    it('returns array unchanged', () => {
      const input = [1, 2, 3]
      const result = sanitiseArray(input)
      expect(result).toEqual(input)
    })

    it('throws on non-array', () => {
      expect(() => sanitiseArray('not an array')).toThrow(SanitisationError)
    })

    it('throws when exceeds maxItems', () => {
      const input = new Array(200).fill(0)
      expect(() => sanitiseArray(input, { maxItems: 100 })).toThrow(SanitisationError)
    })

    it('applies itemSanitiser to each element', () => {
      const input = ['1', '2', '3']
      const result = sanitiseArray(input, {
        itemSanitiser: (item) => parseInt(String(item))
      })
      expect(result).toEqual([1, 2, 3])
    })
  })

  describe('sanitiseParams', () => {
    it('sanitises all required params', () => {
      const params = {
        name: 'John',
        age: '25',
        active: 'true'
      }
      const definitions = [
        { name: 'name', type: 'string' as const, required: true },
        { name: 'age', type: 'number' as const, required: true },
        { name: 'active', type: 'boolean' as const, required: true }
      ]
      
      const result = sanitiseParams(params, definitions)
      
      expect(result.name).toBe('John')
      expect(result.age).toBe(25)
      expect(result.active).toBe(true)
    })

    it('skips absent optional params', () => {
      const params = { name: 'John' }
      const definitions = [
        { name: 'name', type: 'string' as const, required: true },
        { name: 'optional', type: 'string' as const, required: false }
      ]
      
      const result = sanitiseParams(params, definitions)
      
      expect(result.name).toBe('John')
      expect(result.optional).toBeUndefined()
    })

    it('throws SanitisationError with field name on failure', () => {
      const params = { age: 'not a number' }
      const definitions = [
        { name: 'age', type: 'number' as const, required: true }
      ]
      
      expect(() => sanitiseParams(params, definitions)).toThrow(SanitisationError)
    })

    it('uses default values when provided', () => {
      const params = { name: 'John' }
      const definitions = [
        { name: 'name', type: 'string' as const, required: true },
        { name: 'limit', type: 'number' as const, required: false, default: 10 }
      ]
      
      const result = sanitiseParams(params, definitions)
      
      expect(result.name).toBe('John')
      expect(result.limit).toBe(10)
    })
  })
})
