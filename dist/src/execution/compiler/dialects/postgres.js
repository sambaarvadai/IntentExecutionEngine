"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDialect = void 0;
class PostgresDialect {
    constructor() {
        this.name = 'postgres';
    }
    quoteIdentifier(name) {
        // Postgres also uses double quotes, same as SQLite
        if (name.includes('.')) {
            return name.split('.').map(p => `"${p}"`).join('.');
        }
        return `"${name}"`;
    }
    placeholder(index) {
        // Postgres uses $1, $2, $3 etc — index is 1-based
        return `$${index}`;
    }
    limitOffset(limit, offset) {
        const parts = [];
        if (limit !== undefined)
            parts.push(`LIMIT ${limit}`);
        if (offset !== undefined)
            parts.push(`OFFSET ${offset}`);
        return parts.join(' ');
    }
    coalesce() { return 'COALESCE'; }
    booleanLiteral(value) { return value ? 'TRUE' : 'FALSE'; }
    cast(expr, toType) {
        const typeMap = { text: 'TEXT', integer: 'INTEGER', real: 'DOUBLE PRECISION' };
        return `${expr}::${typeMap[toType]}`;
        // Postgres prefers :: cast syntax over CAST()
    }
}
exports.PostgresDialect = PostgresDialect;
//# sourceMappingURL=postgres.js.map