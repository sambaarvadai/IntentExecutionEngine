export interface TurnRecord {
  turnId: string
  timestamp: number
  rawQuery: string
  intentSummary: {
    action: string
    subject: string
    filters?: string[]
    grouping?: string
    metric?: string
    sorting?: string
    limit?: number
  }
  intent: {               // stripped QueryIntent — no functions
    tables: string[]
    filters: any[]
    aggregate?: any[]
    groupBy?: string[]
    having?: any[]
    orderBy?: any[]
    distinct?: boolean
    limit?: number
  }
  resultShape: {
    rowCount: number
    columns: string[]
    primaryTable: string
    primaryKeyValues: unknown[]   // e.g. [1, 3, 7] — for "those customers"
    sampleRows: Record<string, unknown>[]  // first 3 rows
  }
}

export interface SessionContext {
  sessionId: string
  turns: TurnRecord[]              // last 5 only, oldest first
  userDefinedTerms: Record<string, {
    description: string            // "customers with total spend > 30000"
    resolvedAs: Partial<{
      tables: string[]
      filters: any[]
      aggregate: any[]
      groupBy: string[]
      having: any[]
      orderBy: any[]
    }>
    definedAt: number
  }>
}
