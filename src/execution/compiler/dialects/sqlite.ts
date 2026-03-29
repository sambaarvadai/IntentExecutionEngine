import { Dialect } from './types';

export class SQLiteDialect implements Dialect {
  name = 'sqlite' as const

  quoteIdentifier(name: string): string {
    // SQLite uses double quotes for identifiers
    // Handle table.column format by quoting each part separately
    if (name.includes('.')) {
      return name.split('.').map(p => `"${p}"`).join('.');
    }
    return `"${name}"`;
  }

  placeholder(index: number): string {
    // SQLite uses ? for all placeholders, index is ignored
    return '?';
  }

  limitOffset(limit?: number, offset?: number): string {
    const parts: string[] = [];
    if (limit !== undefined) parts.push(`LIMIT ${limit}`);
    if (offset !== undefined) parts.push(`OFFSET ${offset}`);
    return parts.join(' ');
  }

  coalesce(): string { return 'IFNULL'; }

  booleanLiteral(value: boolean): string { return value ? '1' : '0'; }

  cast(expr: string, toType: 'text' | 'integer' | 'real'): string {
    const typeMap = { text: 'TEXT', integer: 'INTEGER', real: 'REAL' };
    return `CAST(${expr} AS ${typeMap[toType]})`;
  }
}
