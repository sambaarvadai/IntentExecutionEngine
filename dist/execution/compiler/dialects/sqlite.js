"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDialect = void 0;
class SQLiteDialect {
    constructor() {
        this.name = 'sqlite';
    }
    quoteIdentifier(name) {
        // SQLite uses double quotes for identifiers
        // Handle table.column format by quoting each part separately
        if (name.includes('.')) {
            return name.split('.').map(p => `"${p}"`).join('.');
        }
        return `"${name}"`;
    }
    placeholder(index) {
        // SQLite uses ? for all placeholders, index is ignored
        return '?';
    }
    limitOffset(limit, offset) {
        const parts = [];
        if (limit !== undefined)
            parts.push(`LIMIT ${limit}`);
        if (offset !== undefined)
            parts.push(`OFFSET ${offset}`);
        return parts.join(' ');
    }
    coalesce() { return 'IFNULL'; }
    booleanLiteral(value) { return value ? '1' : '0'; }
    cast(expr, toType) {
        const typeMap = { text: 'TEXT', integer: 'INTEGER', real: 'REAL' };
        return `CAST(${expr} AS ${typeMap[toType]})`;
    }
}
exports.SQLiteDialect = SQLiteDialect;
//# sourceMappingURL=sqlite.js.map