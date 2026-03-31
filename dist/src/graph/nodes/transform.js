"use strict";
// ------------------------------------------------------------------
// Transform Node Factory Functions
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeByKey = mergeByKey;
exports.filterRows = filterRows;
exports.pickFields = pickFields;
exports.mapRows = mapRows;
exports.sortRows = sortRows;
exports.aggregateRows = aggregateRows;
exports.limitRows = limitRows;
// ------------------------------------------------------------------
// 1. mergeByKey - Join two datasets on specified keys
// ------------------------------------------------------------------
function mergeByKey(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const left = input[params.leftKey]?.rows ?? [];
            const right = input[params.rightKey]?.rows ?? [];
            const mergedRows = left.map((leftRow) => {
                const matchingRightRows = right.filter((rightRow) => rightRow[params.foreignKey] === leftRow[params.on]);
                return {
                    ...leftRow,
                    [params.outputField]: matchingRightRows
                };
            });
            const leftFields = input[params.leftKey]?.fields ?? [];
            return {
                rows: mergedRows,
                fields: [...leftFields, params.outputField]
            };
        }
    };
}
// ------------------------------------------------------------------
// 2. filterRows - Filter dataset based on predicate
// ------------------------------------------------------------------
function filterRows(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            const filteredRows = dataset.rows.filter(params.predicate);
            return {
                rows: filteredRows,
                fields: dataset.fields
            };
        }
    };
}
// ------------------------------------------------------------------
// 3. pickFields - Select only specified fields from dataset
// ------------------------------------------------------------------
function pickFields(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            const pickedRows = dataset.rows.map((row) => {
                const picked = {};
                params.fields.forEach(field => {
                    if (row[field] !== undefined) {
                        picked[field] = row[field];
                    }
                });
                return picked;
            });
            return {
                rows: pickedRows,
                fields: params.fields
            };
        }
    };
}
// ------------------------------------------------------------------
// 4. mapRows - Apply transformation function to each row
// ------------------------------------------------------------------
function mapRows(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            const mappedRows = dataset.rows.map(params.mapper);
            return {
                rows: mappedRows,
                fields: dataset.fields
            };
        }
    };
}
// ------------------------------------------------------------------
// 5. sortRows - Sort dataset by specified field
// ------------------------------------------------------------------
function sortRows(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            const sortedRows = [...dataset.rows].sort((a, b) => {
                const aVal = a[params.field];
                const bVal = b[params.field];
                if (aVal === undefined || aVal === null)
                    return 1;
                if (bVal === undefined || bVal === null)
                    return -1;
                let comparison = 0;
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    comparison = aVal.localeCompare(bVal);
                }
                else {
                    comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }
                return params.direction === 'desc' ? -comparison : comparison;
            });
            return {
                rows: sortedRows,
                fields: dataset.fields
            };
        }
    };
}
// ------------------------------------------------------------------
// 6. aggregateRows - Aggregate dataset with specified functions
// ------------------------------------------------------------------
function aggregateRows(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            // Group rows if groupBy is specified
            let groups = {};
            if (params.groupBy && params.groupBy.length > 0) {
                dataset.rows.forEach((row) => {
                    const key = params.groupBy.map(field => row[field]).join('|');
                    if (!groups[key])
                        groups[key] = [];
                    groups[key].push(row);
                });
            }
            else {
                groups['all'] = dataset.rows;
            }
            // Apply aggregations to each group
            const aggregatedRows = Object.entries(groups).map(([groupKey, groupRows]) => {
                const result = {};
                // attach groupBy field values directly to result
                if (params.groupBy) {
                    params.groupBy.forEach(field => {
                        result[field] = groupRows[0][field];
                    });
                }
                Object.entries(params.aggregations).forEach(([field, aggConfig]) => {
                    const values = groupRows.map(row => row[field]).filter(v => v !== undefined && v !== null);
                    if (aggConfig.count) {
                        result[`${field}_count`] = values.length;
                    }
                    if (aggConfig.sum && values.length > 0) {
                        const numericValues = values.filter(v => typeof v === 'number');
                        result[`${field}_sum`] = numericValues.reduce((sum, val) => sum + val, 0);
                    }
                    if (aggConfig.avg && values.length > 0) {
                        const numericValues = values.filter(v => typeof v === 'number');
                        const sum = numericValues.reduce((s, v) => s + v, 0);
                        result[`${field}_avg`] = sum / numericValues.length;
                    }
                    if (aggConfig.min && values.length > 0) {
                        const numericValues = values.filter(v => typeof v === 'number');
                        result[`${field}_min`] = Math.min(...numericValues);
                    }
                    if (aggConfig.max && values.length > 0) {
                        const numericValues = values.filter(v => typeof v === 'number');
                        result[`${field}_max`] = Math.max(...numericValues);
                    }
                });
                return result;
            });
            return {
                rows: aggregatedRows,
                fields: [
                    ...dataset.fields,
                    ...Object.entries(params.aggregations)
                        .filter(([_, aggConfig]) => Object.values(aggConfig).some(Boolean))
                        .flatMap(([field]) => Object.keys(params.aggregations[field]).map(op => `${field}_${op}`))
                ]
            };
        }
    };
}
function limitRows(params) {
    return {
        id: params.id,
        type: 'transform',
        label: params.label,
        transform: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            return {
                rows: dataset.rows.slice(0, params.n),
                fields: dataset.fields
            };
        }
    };
}
//# sourceMappingURL=transform.js.map