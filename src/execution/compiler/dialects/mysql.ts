import { Dialect } from './types';

export class MySQLDialect implements Dialect {
  name = 'mysql' as const

  quoteIdentifier(name: string): string {
    // MySQL uses backticks — this is the main structural difference
    if (name.includes('.')) {
      return name.split('.').map(p => `\`${p}\``).join('.');
    }
    return `\`${name}\``;
  }

  placeholder(index: number): string {
    // MySQL uses ? like SQLite
    return '?';
  }

  limitOffset(limit?: number, offset?: number): string {
    if (limit !== undefined && offset !== undefined) {
      return `LIMIT ${offset}, ${limit}`;
      // MySQL supports LIMIT offset, count syntax
    }
    if (limit !== undefined) return `LIMIT ${limit}`;
    if (offset !== undefined) return `LIMIT 18446744073709551615 OFFSET ${offset}`;
    // MySQL requires a LIMIT to use OFFSET alone — use max bigint
    return '';
  }

  coalesce(): string { return 'IFNULL'; }

  booleanLiteral(value: boolean): string { return value ? 'TRUE' : 'FALSE'; }

  cast(expr: string, toType: 'text' | 'integer' | 'real'): string {
    const typeMap = { text: 'CHAR', integer: 'SIGNED', real: 'DECIMAL(10,4)' };
    return `CAST(${expr} AS ${typeMap[toType]})`;
  }
}
