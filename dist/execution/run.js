"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executePlan = executePlan;
const sqlite_1 = require("../db/sqlite");
const plans_1 = require("../plans");
const compile_1 = require("./compile");
async function executePlan(plan) {
    try {
        // Validate the plan first
        const validationResult = (0, plans_1.validatePlan)(plan);
        // If validation fails, return error with details
        if (!validationResult.valid) {
            return {
                success: false,
                error: `Validation failed: ${validationResult.issues.map(i => `[${i.field}] ${i.message}`).join('; ')}`
            };
        }
        // Handle conversational responses
        if (!plan.needsDb) {
            return {
                success: true,
                data: plan.responseMode === 'conversational' ? 'conversational' : 'unknown'
            };
        }
        // Execute database query
        const db = await (0, sqlite_1.getDatabase)();
        const compiled = (0, compile_1.compileQuery)(plan);
        // Debug logging
        console.log('Debug: SQL:', compiled.sql);
        console.log('Debug: Params:', compiled.params);
        const rows = await db.all(compiled.sql, compiled.params);
        const queryResult = {
            rows,
            fields: rows.length > 0 ? Object.keys(rows[0]) : []
        };
        return {
            success: true,
            data: queryResult
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
//# sourceMappingURL=run.js.map