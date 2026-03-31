// ------------------------------------------------------------------
// Intent Types
// ------------------------------------------------------------------

export interface QueryIntent {
  tables: string[]           // all tables needed, e.g. ["orders","customers"]
  filters: {
    field: string            // "orders.created_at"
    op: '>=' | '<=' | '>' | '<' | '=' | '!=' | 'IN' | 'LIKE'
    value: unknown           // "2023-01-01" or ["Laptop","Phone"]
  }[]
  select: string[]           // ["customers.id","customers.name","customers.city"]
                             // empty = SELECT * from primary table
  orderBy?: { field: string; direction: 'asc' | 'desc' }[]
  groupBy?: string[]      // fields to GROUP BY
  distinct?: boolean      // SELECT DISTINCT
  aggregate?: {           // for aggregation queries
    type: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countDistinct'
    field?: string        // required for sum/avg/min/max
    alias?: string        // optional output label
  }[]
  having?: { field: string; op: string; value: unknown }[]  // filters on aggregate results
  limit?: number
  conversational?: boolean   // true if query is not a DB query
}
