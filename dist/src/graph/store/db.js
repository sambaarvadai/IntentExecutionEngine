"use strict";
// ------------------------------------------------------------------
// Graph Store Database - Separate from main application database
// ------------------------------------------------------------------
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGraphDatabase = getGraphDatabase;
exports.closeGraphDatabase = closeGraphDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
let graphDb = null;
async function getGraphDatabase() {
    if (!graphDb) {
        const config = (0, config_1.getConfig)();
        // Create a separate database file for graph persistence
        const dbPath = path_1.default.join(process.cwd(), config.database.path, 'graphs.db');
        graphDb = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database
        });
    }
    return graphDb;
}
async function closeGraphDatabase() {
    if (graphDb) {
        await graphDb.close();
        graphDb = null;
    }
}
//# sourceMappingURL=db.js.map