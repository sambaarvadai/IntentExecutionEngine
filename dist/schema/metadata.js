"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchemaMetadata = getSchemaMetadata;
exports.getAllowedTables = getAllowedTables;
exports.getAllowedFields = getAllowedFields;
exports.isFieldAllowed = isFieldAllowed;
exports.isTableAllowed = isTableAllowed;
exports.isOperatorAllowed = isOperatorAllowed;
exports.isAggregationAllowed = isAggregationAllowed;
const config_1 = require("../config");
function getSchemaMetadata() {
    const schemaConfig = (0, config_1.getSchemaConfig)();
    // Convert JSON schema to internal format
    const tables = {};
    for (const [tableName, tableData] of Object.entries(schemaConfig.tables)) {
        const fields = {};
        for (const [fieldName, fieldData] of Object.entries(tableData.fields)) {
            const fieldDef = fieldData;
            fields[`${tableName}.${fieldName}`] = {
                type: fieldDef.type,
                filterable: fieldDef.filterable,
                selectable: fieldDef.selectable,
                sortable: fieldDef.sortable
            };
        }
        // Add wildcard support
        fields[`${tableName}.*`] = {
            type: 'text',
            filterable: false,
            selectable: true,
            sortable: false
        };
        tables[tableName] = {
            fields,
            joins: undefined
        };
    }
    // Add joins from schema config
    if (schemaConfig.joins) {
        for (const [joinName, joinData] of Object.entries(schemaConfig.joins)) {
            const [fromTable, toTable] = joinName.split('.');
            if (tables[fromTable]) {
                tables[fromTable].joins = tables[fromTable].joins || {};
                tables[fromTable].joins[toTable] = `${joinData.from} = ${joinData.to}`;
            }
        }
    }
    // Derive relationships from foreign keys
    const relationships = [];
    for (const [tableName, tableData] of Object.entries(schemaConfig.tables)) {
        const fks = tableData.foreignKeys ?? [];
        for (const fk of fks) {
            relationships.push({
                fromTable: tableName,
                fromField: fk.field,
                toTable: fk.references.table,
                toField: fk.references.field,
                type: 'many-to-one' // FK side is always many-to-one
            });
        }
    }
    const metadata = {
        tables,
        allowedAggregations: ['count', 'sum', 'avg', 'min', 'max'],
        allowedOperators: ['=', '!=', '>', '<', '>=', '<=', 'LIKE'],
        maxLimit: 20, // Will be updated from config later
        relationships
    };
    return metadata;
}
function getAllowedTables() {
    const metadata = getSchemaMetadata();
    return Object.keys(metadata.tables);
}
function getAllowedFields(table) {
    const metadata = getSchemaMetadata();
    if (table && metadata.tables[table]) {
        return Object.keys(metadata.tables[table].fields);
    }
    const allFields = [];
    for (const tableName of Object.keys(metadata.tables)) {
        allFields.push(...Object.keys(metadata.tables[tableName].fields));
    }
    return allFields;
}
function isFieldAllowed(field) {
    return getAllowedFields().includes(field);
}
function isTableAllowed(table) {
    return getAllowedTables().includes(table);
}
function isOperatorAllowed(operator) {
    const metadata = getSchemaMetadata();
    return metadata.allowedOperators.includes(operator);
}
function isAggregationAllowed(agg) {
    const metadata = getSchemaMetadata();
    return metadata.allowedAggregations.includes(agg);
}
//# sourceMappingURL=metadata.js.map