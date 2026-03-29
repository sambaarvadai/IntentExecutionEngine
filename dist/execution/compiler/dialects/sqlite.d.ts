import { Dialect } from './types';
export declare class SQLiteDialect implements Dialect {
    name: "sqlite";
    quoteIdentifier(name: string): string;
    placeholder(index: number): string;
    limitOffset(limit?: number, offset?: number): string;
    coalesce(): string;
    booleanLiteral(value: boolean): string;
    cast(expr: string, toType: 'text' | 'integer' | 'real'): string;
}
//# sourceMappingURL=sqlite.d.ts.map