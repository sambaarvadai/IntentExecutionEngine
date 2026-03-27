"use strict";
// src/graph/nodes/query.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQueryNode = buildQueryNode;
exports.buildFilteredQueryNode = buildFilteredQueryNode;
exports.buildPaginatedQueryNode = buildPaginatedQueryNode;
function buildQueryNode(params) {
    return {
        id: params.id,
        type: 'query',
        label: params.label,
        timeoutMs: params.timeoutMs,
        plan: params.plan
    };
}
function buildFilteredQueryNode(params) {
    const plan = {
        needsDb: true,
        entity: params.entity,
        select: params.select,
        where: [{
                field: params.field,
                op: params.op,
                value: params.value
            }]
    };
    return buildQueryNode({
        id: params.id,
        label: params.label,
        plan,
        timeoutMs: params.timeoutMs
    });
}
function buildPaginatedQueryNode(params) {
    const plan = {
        needsDb: true,
        entity: params.entity,
        select: params.select,
        limit: params.limit,
        offset: params.offset,
        orderBy: params.orderBy
    };
    return buildQueryNode({
        id: params.id,
        label: params.label,
        plan,
        timeoutMs: params.timeoutMs
    });
}
//# sourceMappingURL=query.js.map