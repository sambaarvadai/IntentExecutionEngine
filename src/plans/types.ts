export interface WhereCondition {
  field: string;
  op: string;
  value: any;
  logic?: 'AND' | 'OR';           // logic connector BEFORE this condition
  conditions?: WhereCondition[];  // for nested groups: { logic: 'OR', conditions: [...] }
}

export interface JoinDef {
  table: string;
  type?: 'LEFT' | 'RIGHT' | 'INNER' | 'FULL' | 'CROSS';
}

export interface AggregateDef {
  type: string;
  field?: string;
  alias?: string;
}

export interface OrderByDef {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryPlan {
  needsDb: boolean;
  entity?: string;
  join?: (string | JoinDef)[];
  select?: string[];
  where?: WhereCondition[];
  aggregate?: AggregateDef | AggregateDef[];
  groupBy?: string[];
  having?: WhereCondition[];
  orderBy?: OrderByDef | OrderByDef[];
  limit?: number;
  offset?: number;
  responseMode?: 'conversational';
}

export interface ConversationalPlan {
  needsDb: false;
  responseMode: 'conversational';
}

export type AnyPlan = QueryPlan | ConversationalPlan;

export interface QueryResult {
  rows: any[];
  fields?: string[];
}

export interface ExecutionResult {
  success: boolean;
  data?: QueryResult | string;
  error?: string;
}
