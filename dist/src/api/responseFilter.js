"use strict";
// src/api/responseFilter.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterResponse = filterResponse;
exports.stripFields = stripFields;
/**
 * Filter API response data based on access control rules
 */
function filterResponse(data, config) {
    console.log('filterResponse called with label:', config.label, 'roles:', config.userRoles, 'hasSensitiveRole:', config.label === 'sensitive' || config.label === 'restricted');
    const hasInternalRole = config.userRoles.some(role => ['admin', 'analyst', 'internal'].includes(role));
    const hasSensitiveRole = config.userRoles.some(role => ['admin', 'data-officer'].includes(role));
    // Internal access: allow admin/analyst/internal roles
    if (config.label === 'internal') {
        if (!hasInternalRole) {
            return {
                filtered: true,
                reason: 'insufficient_role'
            };
        }
        // Apply sensitive field stripping for all internal users
        if (config.sensitiveFields && config.sensitiveFields.length > 0) {
            return stripFields(data, config.sensitiveFields);
        }
        return data;
    }
    // Sensitive: requires admin or data-officer
    if (config.label === 'sensitive') {
        if (!hasSensitiveRole) {
            return { filtered: true, reason: 'insufficient_role' };
        }
        if (config.sensitiveFields && config.sensitiveFields.length > 0) {
            return stripFields(data, config.sensitiveFields);
        }
        return data;
    }
    // Restricted: requires admin only
    if (config.label === 'restricted') {
        const hasAdminRole = config.userRoles.includes('admin');
        if (!hasAdminRole) {
            return { filtered: true, reason: 'insufficient_role' };
        }
        if (config.sensitiveFields && config.sensitiveFields.length > 0) {
            return stripFields(data, config.sensitiveFields);
        }
        return data;
    }
    return data;
}
/**
 * Strip specified fields from data objects (rows or plain objects)
 */
function stripFields(data, fields) {
    // If data has .rows array: strip fields from each row object
    if (data && typeof data === 'object' && data.rows && Array.isArray(data.rows)) {
        return {
            ...data,
            rows: data.rows.map((row) => {
                const strippedRow = { ...row };
                for (const field of fields) {
                    delete strippedRow[field];
                }
                return strippedRow;
            })
        };
    }
    // If data is array: strip fields from each item
    if (Array.isArray(data)) {
        return data.map(item => {
            const strippedItem = { ...item };
            for (const field of fields) {
                delete strippedItem[field];
            }
            return strippedItem;
        });
    }
    // If data is plain object: strip fields directly
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const strippedData = { ...data };
        for (const field of fields) {
            delete strippedData[field];
        }
        return strippedData;
    }
    // Return data unchanged if no stripping needed
    return data;
}
//# sourceMappingURL=responseFilter.js.map