"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySQLDialect = exports.PostgresDialect = exports.SQLiteDialect = void 0;
exports.getDialect = getDialect;
const sqlite_1 = require("./sqlite");
Object.defineProperty(exports, "SQLiteDialect", { enumerable: true, get: function () { return sqlite_1.SQLiteDialect; } });
const postgres_1 = require("./postgres");
Object.defineProperty(exports, "PostgresDialect", { enumerable: true, get: function () { return postgres_1.PostgresDialect; } });
const mysql_1 = require("./mysql");
Object.defineProperty(exports, "MySQLDialect", { enumerable: true, get: function () { return mysql_1.MySQLDialect; } });
const registry = {
    sqlite: () => new sqlite_1.SQLiteDialect(),
    postgres: () => new postgres_1.PostgresDialect(),
    mysql: () => new mysql_1.MySQLDialect()
};
function getDialect(name) {
    const factory = registry[name];
    if (!factory)
        throw new Error(`Unknown dialect: ${name}`);
    return factory();
}
//# sourceMappingURL=index.js.map