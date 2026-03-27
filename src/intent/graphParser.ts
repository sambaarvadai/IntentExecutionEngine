// ------------------------------------------------------------------
// Intent Graph Parser
// ------------------------------------------------------------------

import { 
  ExecutionGraph, 
  ExecutionNode, 
  ExecutionEdge 
} from '../graph/types';

import { validatePlan } from '../plans/validator';

import { 
  NodeFactorySpec, 
  PredicateSpec,
  EqualsPredicate,
  GreaterThanPredicate,
  LessThanPredicate,
  ContainsPredicate,
  InPredicate,
  IsNullPredicate,
  IsNotNullPredicate,
  BetweenPredicate,
  StartsWithPredicate
} from './types';

// Import factory functions
import {
  mergeByKey,
  filterRows,
  pickFields,
  sortRows,
  limitRows,
  aggregateRows
} from '../graph/nodes/transform';

import {
  buildLogNode,
  buildWebhookNode
} from '../graph/nodes/notify';

import {
  ifEmpty,
  ifRowCountAbove,
  ifFieldEquals
} from '../graph/nodes/condition';

// ------------------------------------------------------------------
// Error Class
// ------------------------------------------------------------------

export class IntentParseError extends Error {
  constructor(
    message: string, 
    public details: unknown,
    public rawText?: string
  ) {
    super(message);
    this.name = 'IntentParseError';
  }
}

// ------------------------------------------------------------------
// Notify Node Resolver
// ------------------------------------------------------------------

export function resolveNotifyNode(spec: NodeFactorySpec): ExecutionNode {
  const factoryName = spec.factory;
  
  switch (factoryName) {
    case 'buildLogNode':
      return buildLogNode({
        id: spec.id,
        label: spec.id, // NodeFactorySpec doesn't have label field, use id
        dataKey: spec.params?.dataKey as string,
        prefix: spec.params?.prefix as string
      });
      
    case 'buildWebhookNode':
      return buildWebhookNode({
        id: spec.id,
        label: spec.id, // NodeFactorySpec doesn't have label field, use id
        url: spec.params?.url as string,
        dataKey: spec.params?.dataKey as string,
        method: spec.params?.method as 'POST' | 'PUT'
      });
      
    default:
      throw new IntentParseError(`Unknown notify factory: ${factoryName}`, spec);
  }
}

// ------------------------------------------------------------------
// Main Parser Function
// ------------------------------------------------------------------

export function parseIntentGraph(raw: unknown): ExecutionGraph {
  // Step 1: Validate raw structure
  if (!raw || typeof raw !== 'object') {
    throw new IntentParseError('Input must be an object', raw);
  }

  const rawObj = raw as Record<string, unknown>;

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
  const nodes: ExecutionNode[] = [];
  for (const rawNode of rawObj.nodes) {
    if (!rawNode || typeof rawNode !== 'object') {
      throw new IntentParseError('Each node must be an object', rawNode);
    }

    const nodeObj = rawNode as Record<string, unknown>;
    
    if (typeof nodeObj.id !== 'string') {
      throw new IntentParseError('Node must have an id string', nodeObj);
    }

    if (typeof nodeObj.type !== 'string') {
      throw new IntentParseError('Node must have a type string', nodeObj);
    }

    if (typeof nodeObj.label !== 'string') {
      throw new IntentParseError('Node must have a label string', nodeObj);
    }

    let parsedNode: ExecutionNode;

    switch (nodeObj.type) {
      case 'query':
        if (!nodeObj.plan || typeof nodeObj.plan !== 'object') {
          throw new IntentParseError(
            `Query node "${nodeObj.id}" is missing a plan object`,
            { nodeId: nodeObj.id, node: nodeObj }
          );
        }

        parsedNode = {
          id: nodeObj.id,
          type: 'query',
          label: nodeObj.label,
          plan: nodeObj.plan as any,
          timeoutMs: typeof nodeObj.timeoutMs === 'number' ? nodeObj.timeoutMs : undefined
        };

        const planResult = validatePlan(parsedNode.plan!);
        if (!planResult.valid) {
          throw new IntentParseError(
            `Query node "${nodeObj.id}" has an invalid QueryPlan`,
            {
              nodeId: nodeObj.id,
              plan: nodeObj.plan,
              issues: planResult.issues,
              llmFeedback: planResult.llmFeedback   // ← structured correction hint
            }
          );
        }
        break;

      case 'transform':
        // Normalize params: handle inline params vs nested params
        const transformSpec: NodeFactorySpec = {
          id: nodeObj.id as string,
          type: 'transform',
          factory: nodeObj.factory as string,
          params: nodeObj.params as Record<string, unknown> ?? 
            Object.fromEntries(
              Object.entries(nodeObj).filter(([k]) => 
                !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)
              )
            )
        };
        parsedNode = resolveTransformNode(transformSpec);
        break;

      case 'condition':
        // Normalize params: handle inline params vs nested params
        const conditionSpec: NodeFactorySpec = {
          id: nodeObj.id as string,
          type: 'condition',
          factory: nodeObj.factory as string,
          params: nodeObj.params as Record<string, unknown> ?? 
            Object.fromEntries(
              Object.entries(nodeObj).filter(([k]) => 
                !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)
              )
            )
        };
        parsedNode = resolveConditionNode(conditionSpec);
        break;

      case 'notify':
        // Normalize params: handle inline params vs nested params
        const notifySpec: NodeFactorySpec = {
          id: nodeObj.id as string,
          type: 'notify',
          factory: nodeObj.factory as string,
          params: nodeObj.params as Record<string, unknown> ?? 
            Object.fromEntries(
              Object.entries(nodeObj).filter(([k]) => 
                !['id', 'type', 'factory', 'label', 'timeoutMs'].includes(k)
              )
            )
        };
        parsedNode = resolveNotifyNode(notifySpec);
        break;

      default:
        throw new IntentParseError(`Unknown node type: ${nodeObj.type}`, nodeObj);
    }

    nodes.push(parsedNode);
  }

  // Step 3: Parse edges
  const edges: ExecutionEdge[] = [];
  for (const rawEdge of rawObj.edges) {
    if (!rawEdge || typeof rawEdge !== 'object') {
      throw new IntentParseError('Each edge must be an object', rawEdge);
    }

    const edgeObj = rawEdge as Record<string, unknown>;

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
    requestContext: rawObj.requestContext as any
  };
}

// ------------------------------------------------------------------
// Transform Node Resolver
// ------------------------------------------------------------------

export function resolveTransformNode(spec: NodeFactorySpec): ExecutionNode {
  if (!spec.params || typeof spec.params !== 'object') {
    throw new IntentParseError('Transform node must have params object', spec);
  }

  const params = { ...spec.params };

  // Convert any PredicateSpec params to real functions
  for (const [key, value] of Object.entries(params)) {
    if (value && typeof value === 'object' && 'op' in value) {
      params[key] = buildPredicate(value as PredicateSpec);
    }
  }

  let node: ExecutionNode;

  switch (spec.factory) {
    case 'mergeByKey':
      node = mergeByKey({
        id: spec.id,
        label: spec.id, // Use id as label since NodeFactorySpec doesn't have label
        leftKey: params.leftKey as string,
        rightKey: params.rightKey as string,
        on: params.on as string,
        foreignKey: params.foreignKey as string,
        outputField: params.outputField as string
      });
      break;

    case 'filterRows':
      node = filterRows({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        predicate: params.predicate as (row: any) => boolean
      });
      break;

    case 'pickFields':
      node = pickFields({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        fields: params.fields as string[]
      });
      break;

    case 'sortRows':
      node = sortRows({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        field: params.field as string,
        direction: params.direction as 'asc' | 'desc'
      });
      break;

    case 'limitRows':
      node = limitRows({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        n: params.n as number
      });
      break;

    case 'aggregateRows':
      node = aggregateRows({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        groupBy: params.groupBy as string[] | undefined,
        aggregations: params.aggregations as Record<string, any>
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

export function resolveConditionNode(spec: NodeFactorySpec): ExecutionNode {
  if (!spec.params || typeof spec.params !== 'object') {
    throw new IntentParseError('Condition node must have params object', spec);
  }

  const params = { ...spec.params };

  let node: ExecutionNode;

  switch (spec.factory) {
    case 'ifEmpty':
      node = ifEmpty({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        trueBranch: params.trueBranch as string,
        falseBranch: params.falseBranch as string
      });
      break;

    case 'ifRowCountAbove':
      node = ifRowCountAbove({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        threshold: params.threshold as number,
        trueBranch: params.trueBranch as string,
        falseBranch: params.falseBranch as string
      });
      break;

    case 'ifFieldEquals':
      node = ifFieldEquals({
        id: spec.id,
        label: spec.id,
        dataKey: params.dataKey as string,
        field: params.field as string,
        value: params.value,
        trueBranch: params.trueBranch as string,
        falseBranch: params.falseBranch as string
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

export function buildPredicate(spec: PredicateSpec): (row: any) => boolean {
  const op = spec.op;
  
  switch (op) {
    case 'equals':
      const equalsSpec = spec as EqualsPredicate;
      return (row: any) => row[equalsSpec.field] === equalsSpec.value;

    case 'greaterThan':
      const greaterThanSpec = spec as GreaterThanPredicate;
      return (row: any) => {
        const fieldValue = row[greaterThanSpec.field];
        const compareValue = greaterThanSpec.value;
        return typeof fieldValue === 'number' && typeof compareValue === 'number' 
          ? fieldValue > compareValue 
          : String(fieldValue) > String(compareValue);
      };

    case 'lessThan':
      const lessThanSpec = spec as LessThanPredicate;
      return (row: any) => {
        const fieldValue = row[lessThanSpec.field];
        const compareValue = lessThanSpec.value;
        return typeof fieldValue === 'number' && typeof compareValue === 'number' 
          ? fieldValue < compareValue 
          : String(fieldValue) < String(compareValue);
      };

    case 'contains':
      const containsSpec = spec as ContainsPredicate;
      return (row: any) => {
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
      const inSpec = spec as InPredicate;
      return (row: any) => inSpec.values.includes(row[inSpec.field]);

    case 'isNull':
      return (row: any) => row[spec.field] === null || 
                           row[spec.field] === undefined;

    case 'isNotNull':
      return (row: any) => row[spec.field] !== null && 
                           row[spec.field] !== undefined;

    case 'between':
      return (row: any) => {
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
      return (row: any) => typeof row[spec.field] === 'string' && 
                           row[spec.field].startsWith(spec.value);

    default:
      throw new IntentParseError(`Unknown predicate operation: ${op}`, spec);
  }
}
