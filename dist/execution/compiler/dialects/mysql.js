"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLDialect = void 0;
class MySQLDialect {
    constructor() {
        this.name = 'mysql';
    }
    quoteIdentifier(name) {
        // MySQL uses backticks — this is the main structural difference
        if (name.includes('.')) {
            return name.split('.').map(p => `\`${p}\``).join('.');
        }
        return `\`${name}\``;
    }
    placeholder(index) {
        // MySQL uses ? like SQLite
        return '?';
    }
    limitOffset(limit, offset) {
        if (limit !== undefined && offset !== undefined) {
            return `LIMIT ${offset}, ${limit}`;
            // MySQL supports LIMIT offset, count syntax
        }
        if (limit !== undefined)
            return `LIMIT ${limit}`;
        if (offset !== undefined)
            return `LIMIT 18446744073709551615 OFFSET ${offset}`;
        // MySQL requires a LIMIT to use OFFSET alone — use max bigint
        return '';
    }
    coalesce() { return 'IFNULL'; }
    booleanLiteral(value) { return value ? 'TRUE' : 'FALSE'; }
    cast(expr, toType) {
        const typeMap = { text: 'CHAR', integer: 'SIGNED', real: 'DECIMAL(10,4)' };
        return `CAST(${expr} AS ${typeMap[toType]})`;
    }
}
exports.MySQLDialect = MySQLDialect;
//# sourceMappingURL=mysql.js.map