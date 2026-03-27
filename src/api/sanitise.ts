// src/api/sanitise.ts

import { SanitisationError } from '../context/types'

/**
 * Sanitises a string value for safe usage in API responses and logs
 */
export function sanitiseString(
  value: unknown, 
  options?: {
    maxLength?: number      // default 1000
    allowHtml?: boolean     // default false
    trim?: boolean          // default true
  }
): string {
  // Throw error if value is not a string
  if (typeof value !== 'string') {
    throw new SanitisationError('value', 'Value must be a string')
  }

  let result = String(value)

  // Trim whitespace if requested
  if (options?.trim !== false) {
    result = result.trim()
  }

  // Remove HTML characters if requested
  if (!options?.allowHtml) {
    result = result
      .replace(/</g, '')
      .replace(/>/g, '')
      .replace(/&/g, '')
      .replace(/"/g, '')
      .replace(/'/g, '')
  }

  // Truncate to max length if specified
  if (options?.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength)
  }

  // Throw error if result is empty after sanitisation
  if (result.length === 0) {
    throw new SanitisationError('value', 'Value cannot be empty after sanitisation')
  }

  return result
}

/**
 * Sanitises a numeric value for safe usage in API parameters
 */
export function sanitiseNumber(
  value: unknown, 
  options?: {
    min?: number
    max?: number
    integer?: boolean    // default false
  }
): number {
  // Throw error if value cannot be parsed as number
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new SanitisationError('value', 'Value must be a number')
  }

  const numValue = Number(value)

  // Check for NaN
  if (isNaN(numValue)) {
    throw new SanitisationError('value', 'Value is not a valid number')
  }

  // Apply min/max constraints
  let result = numValue
  if (options?.min !== undefined && result < options.min) {
    throw new SanitisationError('value', `Value must be at least ${options.min}`)
  }
  if (options?.max !== undefined && result > options.max) {
    throw new SanitisationError('value', `Value must be at most ${options.max}`)
  }

  // Check integer constraint
  if (options?.integer && !Number.isInteger(result)) {
    throw new SanitisationError('value', 'Value must be an integer')
  }

  return result
}

/**
 * Sanitises a boolean value for safe usage in API parameters
 */
export function sanitiseBoolean(value: unknown): boolean {
  // Accept only true, false, '1', '0', 1, 0
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false
  }
  
  throw new SanitisationError('value', 'Value must be a boolean')
}

/**
 * Sanitises an array value for safe usage in API parameters
 */
export function sanitiseArray(
  value: unknown, 
  options?: {
    maxItems?: number      // default 100
    itemSanitiser?: (item: unknown) => any
  }
): any[] {
  // Throw error if value is not an array
  if (!Array.isArray(value)) {
    throw new SanitisationError('value', 'Value must be an array')
  }

  // Apply max items constraint
  if (options?.maxItems && value.length > options.maxItems) {
    throw new SanitisationError('value', `Array cannot have more than ${options.maxItems} items`)
  }

  // Apply item sanitiser if provided
  if (options?.itemSanitiser) {
    return value.map(options.itemSanitiser)
  }

  return value
}

/**
 * Sanitises request parameters based on definitions
 */
export function sanitiseParams(
  params: Record<string, unknown>,
  definitions: Array<{
    name: string
    type: 'string' | 'number' | 'boolean' | 'array'
    required?: boolean
    default?: any
  }>
): Record<string, any> {
  const result: Record<string, any> = {}
  
  for (const def of definitions) {
    const value = params[def.name]
    
    // Skip if parameter is not provided and not required
    if (value === undefined && !def.required) {
      if (def.default !== undefined) {
        result[def.name] = def.default
      }
      continue
    }
    
    try {
      // Apply appropriate sanitiser based on type
      let sanitisedValue: any
      
      switch (def.type) {
        case 'string':
          sanitisedValue = sanitiseString(value)
          break
          
        case 'number':
          sanitisedValue = sanitiseNumber(value)
          break
          
        case 'boolean':
          sanitisedValue = sanitiseBoolean(value)
          break
          
        case 'array':
          sanitisedValue = sanitiseArray(value)
          break
          
        default:
          throw new SanitisationError('parameter', `Unknown parameter type: ${def.type}`)
      }
      
      // Use default value if provided and sanitised value is undefined
      if (def.default !== undefined && result[def.name] === undefined) {
        result[def.name] = def.default
      } else {
        result[def.name] = sanitisedValue
      }
    } catch (error: any) {
      console.log('Error processing param:', def.name, ':', error)
      throw new SanitisationError(def.name, error instanceof Error ? error.message : String(error))
    }
  }
  
  return result
}
