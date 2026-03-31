"use strict";
// src/graph/nodes/condition.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ifEmpty = ifEmpty;
exports.ifRowCountAbove = ifRowCountAbove;
exports.ifFieldEquals = ifFieldEquals;
exports.ifHasRole = ifHasRole;
function ifEmpty(params) {
    return {
        id: params.id,
        type: 'condition',
        label: params.label,
        condition: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            return dataset.rows.length === 0;
        },
        trueBranch: params.trueBranch,
        falseBranch: params.falseBranch
    };
}
function ifRowCountAbove(params) {
    return {
        id: params.id,
        type: 'condition',
        label: params.label,
        condition: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            return dataset.rows.length > params.threshold;
        },
        trueBranch: params.trueBranch,
        falseBranch: params.falseBranch
    };
}
function ifFieldEquals(params) {
    return {
        id: params.id,
        type: 'condition',
        label: params.label,
        condition: (input) => {
            const dataset = input[params.dataKey] ?? { rows: [], fields: [] };
            if (dataset.rows.length === 0)
                return false;
            return dataset.rows.every((row) => row[params.field] === params.value);
        },
        trueBranch: params.trueBranch,
        falseBranch: params.falseBranch
    };
}
function ifHasRole(params) {
    return {
        id: params.id,
        type: 'condition',
        label: params.label,
        condition: (input) => {
            const context = input._context;
            return context?.roles?.includes(params.role) ?? false;
        },
        trueBranch: params.trueBranch,
        falseBranch: params.falseBranch
    };
}
//# sourceMappingURL=condition.js.map