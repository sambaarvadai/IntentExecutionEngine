"use strict";
// ------------------------------------------------------------------
// Intent Graph Parser
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentParseError = void 0;
exports.resolveNotifyNode = resolveNotifyNode;
exports.parseIntentGraph = parseIntentGraph;
exports.resolveTransformNode = resolveTransformNode;
exports.resolveConditionNode = resolveConditionNode;
exports.buildPredicate = buildPredicate;
const validator_1 = require("../plans/validator");
// Import factory functions
const transform_1 = require("../graph/nodes/transform");
const notify_1 = require("../graph/nodes/notify");
const condition_1 = require("../graph/nodes/condition");
// ------------------------------------------------------------------
// Error Class
// ------------------------------------------------------------------
class IntentParseError extends Error {
    constructor(message, details, rawText) {
        super(message);
        this.details = details;
        this.rawText = rawText;
        this.name = 'IntentParseError';
    }
}
exports.IntentParseError = IntentParseError;
// ------------------------------------------------------------------
// Notify Node Resolver
// ------------------------------------------------------------------
function resolveNotifyNode(spec) {
    const factoryName = spec.factory;
    switch (factoryName) {
        case 'buildLogNode':
            return (0, notify_1.buildLogNode)({
                id: spec.id,
                label: spec.id, // NodeFactorySpec doesn't have label field, use id
                dataKey: spec.params?.dataKey,
                prefix: spec.params?.prefix
            });
        case 'buildWebhookNode':
            return (0, notify_1.buildWebhookNode)({
                id: spec.id,
                label: spec.id, // NodeFactorySpec doesn't have label field, use id
                url: spec.params?.url,
                dataKey: spec.params?.dataKey,
                method: spec.params?.method
            });
        default:
            throw new IntentParseError(`Unknown notify factory: ${factoryName}`, spec);
    }
}
// ------------------------------------------------------------------
// Main Parser Function
// ------------------------------------------------------------------
function parseIntentGraph(raw) {
    // Step 1: Validate raw structure
    if (!raw || typeof raw !== 'object') {
        throw new IntentParseError('Input must be an object', raw);
    }
    const rawObj = raw;
    if (!Array.isArray(rawObj.nodes)) {
        throw new IntentParseError('Graph must have a nodes array', raw);
    }
    if (!Array.isArray(rawObj.edges)) {
        throw new IntentParseError('Graph must have an edges array', raw);
    }
    if (typeof rawObj.id !== 'string') {
        throw new IntentParseError('Graph must have an id string', raw);
    }
    if (typeof rawObj.label !== 'string') {
        throw new IntentParseError('Graph must have a label string', raw);
    }
    if (typeof rawObj.entryNode !== 'string') {
        throw new IntentParseError('Graph must have an entryNode string', raw);
    }
    // Step 2: Parse nodes
    const nodes = [];
    for (const rawNode of rawObj.nodes) {
        if (!rawNode || typeof rawNode !== 'object') {
            throw new IntentParseError('Each node must be an object', rawNode);
        }
        const nodeObj = rawNode;
        if (typeof nodeObj.id !== 'string') {
            throw new IntentParseError('Node must have an id string', nodeObj);
        }
        if (typeof nodeObj.type !== 'string') {
            throw new IntentParseError('Node must have a type string', nodeObj);
        }
        if (typeof nodeObj.label !== 'string') {
            throw new IntentParseError('Node must have a label string', nodeObj);
        }
        let parsedNode;
        switch (nodeObj.type) {
            case 'query':
                if (!nodeObj.plan || typeof nodeObj.plan !== 'object') {
                    throw new IntentParseError(`Query node "${nodeObj.id}" is missing a plan object`, { nodeId: nodeObj.id, node: nodeObj });
                }
                parsedNode = {
                    id: nodeObj.id,
                    type: 'query',
                    label: nodeObj.label,
                    plan: nodeObj.plan,
                    timeoutMs: typeof nodeObj.timeoutMs === 'number' ? nodeObj.timeoutMs : undefined
                };
                const planResult = (0, validator_1.validatePlan)(parsedNode.plan);
                if (!planResult.valid) {
                    throw new IntentParseError(`Query node "${nodeObj.id}" has an invalid QueryPlan`, {
                        nodeId: nodeObj.id,
                        plan: nodeObj.plan,
                        issues: planResult.issues,
                        llmFeedback: planResult.llmFeedback // ← structured correction hint
                    });
                }
                break;
            case 'transform':
                // Normalize params: handle inline params vs nested params
                const transformSpec = {
                    id: nodeObj.id,
                    type: 'transform',
                    factory: nodeObj.factory,
                    params: nodeObj.params ??
                        Object.fromEntries(Object.entries(nodeObj).filter(([k]) => !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)))
                };
                parsedNode = resolveTransformNode(transformSpec);
                break;
            case 'condition':
                // Normalize params: handle inline params vs nested params
                const conditionSpec = {
                    id: nodeObj.id,
                    type: 'condition',
                    factory: nodeObj.factory,
                    params: nodeObj.params ??
                        Object.fromEntries(Object.entries(nodeObj).filter(([k]) => !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)))
                };
                parsedNode = resolveConditionNode(conditionSpec);
                break;
            case 'notify':
                // Normalize params: handle inline params vs nested params
                const notifySpec = {
                    id: nodeObj.id,
                    type: 'notify',
                    factory: nodeObj.factory,
                    params: nodeObj.params ??
                        Object.fromEntries(Object.entries(nodeObj).filter(([k]) => !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)))
                };
                parsedNode = resolveNotifyNode(notifySpec);
                break;
            default:
                throw new IntentParseError(`Unknown node type: ${nodeObj.type}`, nodeObj);
        }
        nodes.push(parsedNode);
    }
    // Step 3: Parse edges
    const edges = [];
    for (const rawEdge of rawObj.edges) {
        if (!rawEdge || typeof rawEdge !== 'object') {
            throw new IntentParseError('Each edge must be an object', rawEdge);
        }
        const edgeObj = rawEdge;
        if (typeof edgeObj.from !== 'string') {
            throw new IntentParseError('Edge must have a from string', edgeObj);
        }
        if (typeof edgeObj.to !== 'string') {
            throw new IntentParseError('Edge must have a to string', edgeObj);
        }
        edges.push({
            from: edgeObj.from,
            to: edgeObj.to,
            label: typeof edgeObj.label === 'string' ? edgeObj.label : undefined,
            dataKey: typeof edgeObj.dataKey === 'string' ? edgeObj.dataKey : undefined
        });
    }
    // Step 4: Return valid ExecutionGraph
    return {
        id: rawObj.id,
        label: rawObj.label,
        nodes,
        edges,
        entryNode: rawObj.entryNode,
        requestContext: rawObj.requestContext
    };
}
// ------------------------------------------------------------------
// Transform Node Resolver
// ------------------------------------------------------------------
function resolveTransformNode(spec) {
    if (!spec.params || typeof spec.params !== 'object') {
        throw new IntentParseError('Transform node must have params object', spec);
    }
    const params = { ...spec.params };
    // Convert any PredicateSpec params to real functions
    for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && 'op' in value) {
            params[key] = buildPredicate(value);
        }
    }
    let node;
    switch (spec.factory) {
        case 'mergeByKey':
            node = (0, transform_1.mergeByKey)({
                id: spec.id,
                label: spec.id, // Use id as label since NodeFactorySpec doesn't have label
                leftKey: params.leftKey,
                rightKey: params.rightKey,
                on: params.on,
                foreignKey: params.foreignKey,
                outputField: params.outputField
            });
            break;
        case 'filterRows':
            node = (0, transform_1.filterRows)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                predicate: params.predicate
            });
            break;
        case 'pickFields':
            node = (0, transform_1.pickFields)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                fields: params.fields
            });
            break;
        case 'sortRows':
            node = (0, transform_1.sortRows)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                field: params.field,
                direction: params.direction
            });
            break;
        case 'limitRows':
            node = (0, transform_1.limitRows)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                n: params.n
            });
            break;
        case 'aggregateRows':
            node = (0, transform_1.aggregateRows)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                groupBy: params.groupBy,
                aggregations: params.aggregations
            });
            break;
        default:
            throw new IntentParseError(`Unknown transform factory: ${spec.factory}`, spec);
    }
    return node;
}
// ------------------------------------------------------------------
// Condition Node Resolver
// ------------------------------------------------------------------
function resolveConditionNode(spec) {
    if (!spec.params || typeof spec.params !== 'object') {
        throw new IntentParseError('Condition node must have params object', spec);
    }
    const params = { ...spec.params };
    let node;
    switch (spec.factory) {
        case 'ifEmpty':
            node = (0, condition_1.ifEmpty)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                trueBranch: params.trueBranch,
                falseBranch: params.falseBranch
            });
            break;
        case 'ifRowCountAbove':
            node = (0, condition_1.ifRowCountAbove)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                threshold: params.threshold,
                trueBranch: params.trueBranch,
                falseBranch: params.falseBranch
            });
            break;
        case 'ifFieldEquals':
            node = (0, condition_1.ifFieldEquals)({
                id: spec.id,
                label: spec.id,
                dataKey: params.dataKey,
                field: params.field,
                value: params.value,
                trueBranch: params.trueBranch,
                falseBranch: params.falseBranch
            });
            break;
        default:
            throw new IntentParseError(`Unknown condition factory: ${spec.factory}`, spec);
    }
    return node;
}
// ------------------------------------------------------------------
// Predicate Builder
// ------------------------------------------------------------------
function buildPredicate(spec) {
    const op = spec.op;
    switch (op) {
        case 'equals':
            const equalsSpec = spec;
            return (row) => row[equalsSpec.field] === equalsSpec.value;
        case 'greaterThan':
            const greaterThanSpec = spec;
            return (row) => {
                const fieldValue = row[greaterThanSpec.field];
                const compareValue = greaterThanSpec.value;
                return typeof fieldValue === 'number' && typeof compareValue === 'number'
                    ? fieldValue > compareValue
                    : String(fieldValue) > String(compareValue);
            };
        case 'lessThan':
            const lessThanSpec = spec;
            return (row) => {
                const fieldValue = row[lessThanSpec.field];
                const compareValue = lessThanSpec.value;
                return typeof fieldValue === 'number' && typeof compareValue === 'number'
                    ? fieldValue < compareValue
                    : String(fieldValue) < String(compareValue);
            };
        case 'contains':
            const containsSpec = spec;
            return (row) => {
                const value = row[containsSpec.field];
                const searchValue = containsSpec.value;
                if (typeof value === 'string') {
                    return value.includes(String(searchValue));
                }
                if (Array.isArray(value)) {
                    return value.includes(searchValue);
                }
                return false;
            };
        case 'in':
            const inSpec = spec;
            return (row) => inSpec.values.includes(row[inSpec.field]);
        case 'isNull':
            return (row) => row[spec.field] === null ||
                row[spec.field] === undefined;
        case 'isNotNull':
            return (row) => row[spec.field] !== null &&
                row[spec.field] !== undefined;
        case 'between':
            return (row) => {
                const v = row[spec.field];
                if (typeof v === 'number' &&
                    typeof spec.low === 'number' &&
                    typeof spec.high === 'number') {
                    return v >= spec.low && v <= spec.high;
                }
                // String comparison fallback (handles ISO dates)
                return String(v) >= String(spec.low) &&
                    String(v) <= String(spec.high);
            };
        case 'startsWith':
            return (row) => typeof row[spec.field] === 'string' &&
                row[spec.field].startsWith(spec.value);
        default:
            throw new IntentParseError(`Unknown predicate operation: ${op}`, spec);
    }
}
//# sourceMappingURL=graphParser.js.map