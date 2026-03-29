import { Dialect } from './types';

export class PostgresDialect implements Dialect {
  name = 'postgres' as const

  quoteIdentifier(name: string): string {
    // Postgres also uses double quotes, same as SQLite
    if (name.includes('.')) {
      return name.split('.').map(p => `"${p}"`).join('.');
    }
    return `"${name}"`;
  }

  placeholder(index: number): string {
    // Postgres uses $1, $2, $3 etc — index is 1-based
    return `$${index}`;
  }

  limitOffset(limit?: number, offset?: number): string {
    const parts: string[] = [];
    if (limit !== undefined) parts.push(`LIMIT ${limit}`);
    if (offset !== undefined) parts.push(`OFFSET ${offset}`);
    return parts.join(' ');
  }

  coalesce(): string { return 'COALESCE'; }

  booleanLiteral(value: boolean): string { return value ? 'TRUE' : 'FALSE'; }

  cast(expr: string, toType: 'text' | 'integer' | 'real'): string {
    const typeMap = { text: 'TEXT', integer: 'INTEGER', real: 'DOUBLE PRECISION' };
    return `${expr}::${typeMap[toType]}`;
    // Postgres prefers :: cast syntax over CAST()
  }
}
