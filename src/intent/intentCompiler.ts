// ------------------------------------------------------------------
// Intent Compiler
// ------------------------------------------------------------------

import { QueryIntent } from './intentTypes';
import { SchemaMetadata } from '../schema/metadata';
import { ExecutionGraph } from '../graph/types';

function deriveAction(intent: QueryIntent): string {
  if (intent.aggregate?.length) {
    return 'Calculating';
  } else if (intent.distinct) {
    return 'Listing unique';
  } else {
    return 'Listing';
  }
}

function deriveSubject(intent: QueryIntent): string {
  const table = intent.tables?.[0];
  if (!table) return 'data';
  return table.charAt(0).toUpperCase() + table.slice(1);
}

function stripTablePrefix(f: string): string {
  if (!f) return '';
  return f.includes('.') ? f.split('.').pop()! : f;
}

function humaniseFilter(filter: any): string {
  if (!filter || !filter.field) return '';
  const col = stripTablePrefix(filter.field);
  return `${col} ${filter.op} ${filter.value}`;
}

function humaniseAggregate(agg: any): string {
  const field = stripTablePrefix(agg.field);
  return `${agg.type} of ${field}`;
}

function humaniseSorting(orderBy: any): string {
  const field = stripTablePrefix(orderBy.field);
  const direction = orderBy.direction === 'desc' ? 'highest first' : 'lowest first';
  return `${field} ${direction}`;
}

export function buildIntentSummary(intent: QueryIntent): {
  action: string;
  subject: string;
  filters?: string[];
  grouping?: string;
  metric?: string;
  sorting?: string;
  limit?: number;
} {
  const action = deriveAction(intent);
  const subject = deriveSubject(intent);
  
  const filters = intent.filters?.length
    ? intent.filters.map(humaniseFilter).filter(Boolean)
    : undefined;
  
  const grouping = intent.groupBy?.length 
    ? intent.groupBy.map(stripTablePrefix).join(', ')
    : undefined;
  
  const metric = intent.aggregate?.length
    ? intent.aggregate.map(humaniseAggregate).join(', ')
    : undefined;
  
  const sorting = intent.orderBy?.[0]
    ? humaniseSorting(intent.orderBy[0])
    : undefined;
  
  return {
    action,
    subject,
    filters,
    grouping,
    metric,
    sorting,
    limit: intent.limit
  };
}

export function humaniseAction(action: string): string {
  const actionMap: Record<string, string> = {
    'list': 'Show',
    'list distinct': 'Show unique',
    'aggregate': 'Calculate',
    'count': 'Count',
    'sum': 'Total',
    'average': 'Average',
    'min': 'Minimum',
    'max': 'Maximum'
  };
  return actionMap[action] || action;
}

export function humaniseSubject(subject: string): string {
  const subjectMap: Record<string, string> = {
    'customers': 'customers',
    'orders': 'orders',
    'products': 'products',
    'users': 'users'
  };
  return subjectMap[subject] || subject;
}

export function formatSummary(summary?: ReturnType<typeof buildIntentSummary>): string {
  if (!summary) return 'Processing your query';
  
  const lines: string[] = [];
  
  lines.push(`${summary.action}: ${summary.subject}`);
  
  if (summary.filters?.length) {
    lines.push(`Where: ${summary.filters.join(', ')}`);
  }
  
  if (summary.metric) {
    lines.push(`Calculating: ${summary.metric}`);
  }
  
  if (summary.grouping) {
    lines.push(`Grouped ${summary.grouping}`);
  }
  
  if (summary.sorting) {
    lines.push(`Sorted by: ${summary.sorting}`);
  }
  
  if (summary.limit) {
    lines.push(`Showing up to ${summary.limit} results`);
  }
  
  return lines.join('\n');
}

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
