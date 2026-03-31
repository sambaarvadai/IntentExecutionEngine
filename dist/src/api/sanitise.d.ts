/**
 * Sanitises a string value for safe usage in API responses and logs
 */
export declare function sanitiseString(value: unknown, options?: {
    maxLength?: number;
    allowHtml?: boolean;
    trim?: boolean;
}): string;
/**
 * Sanitises a numeric value for safe usage in API parameters
 */
export declare function sanitiseNumber(value: unknown, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
}): number;
/**
 * Sanitises a boolean value for safe usage in API parameters
 */
export declare function sanitiseBoolean(value: unknown): boolean;
/**
 * Sanitises an array value for safe usage in API parameters
 */
export declare function sanitiseArray(value: unknown, options?: {
    maxItems?: number;
    itemSanitiser?: (item: unknown) => any;
}): any[];
/**
 * Sanitises request parameters based on definitions
 */
export declare function sanitiseParams(params: Record<string, unknown>, definitions: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    required?: boolean;
    default?: any;
}>): Record<string, any>;
//# sourceMappingURL=sanitise.d.ts.map