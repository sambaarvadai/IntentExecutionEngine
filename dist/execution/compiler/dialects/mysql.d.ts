import { Dialect } from './types';
export declare class MySQLDialect implements Dialect {
    name: "mysql";
    quoteIdentifier(name: string): string;
    placeholder(index: number): string;
    limitOffset(limit?: number, offset?: number): string;
    coalesce(): string;
    booleanLiteral(value: boolean): string;
    cast(expr: string, toType: 'text' | 'integer' | 'real'): string;
}
//# sourceMappingURL=mysql.d.ts.map