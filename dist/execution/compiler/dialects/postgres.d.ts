import { Dialect } from './types';
export declare class PostgresDialect implements Dialect {
    name: "postgres";
    quoteIdentifier(name: string): string;
    placeholder(index: number): string;
    limitOffset(limit?: number, offset?: number): string;
    coalesce(): string;
    booleanLiteral(value: boolean): string;
    cast(expr: string, toType: 'text' | 'integer' | 'real'): string;
}
//# sourceMappingURL=postgres.d.ts.map