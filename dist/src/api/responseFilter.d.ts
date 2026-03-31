import { DataAccessLabel } from '../context/types';
/**
 * Response filtering based on user roles and data sensitivity
 */
export interface FilterConfig {
    label: DataAccessLabel;
    userRoles: string[];
    sensitiveFields?: string[];
}
/**
 * Filter API response data based on access control rules
 */
export declare function filterResponse(data: any, config: FilterConfig): any;
/**
 * Strip specified fields from data objects (rows or plain objects)
 */
export declare function stripFields(data: any, fields: string[]): any;
//# sourceMappingURL=responseFilter.d.ts.map