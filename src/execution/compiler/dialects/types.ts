export type DialectName = 'sqlite' | 'postgres' | 'mysql'

export interface Dialect {
  name: DialectName

  // Identifier quoting
  quoteIdentifier(name: string): string

  // Parameterised placeholder — SQLite/MySQL use ?, Postgres uses $1 $2 etc
  placeholder(index: number): string

  // LIMIT/OFFSET clause — all three have slightly different syntax
  limitOffset(limit?: number, offset?: number): string

  // Null coalescing function name
  coalesce(): string           // 'IFNULL' | 'COALESCE' | 'IFNULL'

  // Boolean literals
  booleanLiteral(value: boolean): string   // '1'/'0' vs 'TRUE'/'FALSE'

  // Cast expression for type coercion
  cast(expr: string, toType: 'text' | 'integer' | 'real'): string
}
