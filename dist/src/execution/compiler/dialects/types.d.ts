export type DialectName = 'sqlite' | 'postgres' | 'mysql';
export interface Dialect {
    name: DialectName;
    quoteIdentifier(name: string): string;
    placeholder(index: number): string;
    limitOffset(limit?: number, offset?: number): string;
    coalesce(): string;
    booleanLiteral(value: boolean): string;
    cast(expr: string, toType: 'text' | 'integer' | 'real'): string;
}
//# sourceMappingURL=types.d.ts.map