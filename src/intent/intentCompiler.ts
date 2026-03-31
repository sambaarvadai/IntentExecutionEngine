// ------------------------------------------------------------------
// Intent Compiler
// ------------------------------------------------------------------

import { QueryIntent } from './intentTypes';
import { SchemaMetadata } from '../schema/metadata';
import { ExecutionGraph } from '../graph/types';

export function compileIntent(
  intent: QueryIntent,
  schema: SchemaMetadata
): ExecutionGraph {
  // Handle conversational responses
  if (intent.conversational) {
    return {
      id: `conversational_${Date.now()}`,
      label: 'Conversational Response',
      nodes: [{
        id: 'conversational',
        type: 'transform',
        label: 'Conversational Response',
        transform: () => 'conversational response'
      }],
      edges: [],
      entryNode: 'conversational',
      requestContext: {
        api: {
          id: 'intent-api',
          route: '/intent',
          method: 'POST',
          planId: 'intent-plan',
          status: 'ACTIVE',
          label: 'Intent Generated API',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        incomingParams: {},
        timestamp: new Date(),
        requestId: `req_${Date.now()}`
      }
    };
  }

  // Determine primary table (first in intent.tables)
  const primaryTable = intent.tables[0];
  if (!primaryTable) {
    throw new Error('No tables specified in intent');
  }

  // Determine joins needed
  const joins: string[] = [];
  for (let i = 1; i < intent.tables.length; i++) {
    joins.push(intent.tables[i]);
  }

  // Build single QueryPlan
  const queryPlan = {
    needsDb: true,
    entity: primaryTable,
    join: joins.length > 0 ? joins : undefined,
    where: intent.filters?.length > 0 ? intent.filters : undefined,
    select: (intent.select?.length > 0 && joins.length === 0)
      ? intent.select : undefined,
    aggregate: intent.aggregate && intent.aggregate.length > 0    // ADD THIS
      ? intent.aggregate : undefined,
    groupBy: intent.groupBy && intent.groupBy.length > 0 ? intent.groupBy : undefined,
    distinct: intent.distinct ?? undefined,
    orderBy: intent.orderBy && Array.isArray(intent.orderBy) && intent.orderBy.length > 0 ? intent.orderBy : undefined,
    having: intent.having && intent.having.length > 0 ? intent.having : undefined,
    limit: intent.limit ?? 20
  };

  // Create query node
  const queryNodeId = 'query_0';
  const queryNode = {
    id: queryNodeId,
    type: 'query' as const,
    label: `Query: ${primaryTable}${joins.length > 0 ? ' with joins' : ''}`,
    plan: queryPlan
  };

  // Return ExecutionGraph with single node
  return {
    id: `graph_${Date.now()}`,
    label: `Query: ${primaryTable}`,
    nodes: [queryNode],
    edges: [],
    entryNode: queryNodeId,
    requestContext: {
      api: {
        id: 'intent-api',
        route: '/intent',
        method: 'POST',
        planId: 'intent-plan',
        status: 'ACTIVE',
        label: 'Intent Generated API',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      incomingParams: {},
      timestamp: new Date(),
      requestId: `req_${Date.now()}`
    }
  };
}
