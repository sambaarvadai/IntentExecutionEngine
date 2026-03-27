"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCompiledQuery = executeCompiledQuery;
const sqlite_1 = require("../db/sqlite");
const config_1 = require("../config");
async function executeCompiledQuery(compiled) {
    try {
        const config = (0, config_1.getConfig)();
        if (config.app.debug && process.env.DEBUG !== 'false') {
            console.log('Debug: SQL:', compiled.sql);
            console.log('Debug: Params:', compiled.params);
        }
        const db = await (0, sqlite_1.getDatabase)();
        const result = await db.all(compiled.sql, compiled.params);
        const queryResult = {
            rows: result,
            fields: result.length > 0 ? Object.keys(result[0]) : []
        };
        return {
            success: true,
            data: queryResult
        };
    }
    catch (error) {
        return {
            success: false,
            data: error.message || 'Unknown error'
        };
    }
}
//# sourceMappingURL=executeCompiled.js.map