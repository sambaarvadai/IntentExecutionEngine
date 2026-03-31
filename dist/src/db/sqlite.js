"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
let db = null;
async function getDatabase() {
    if (!db) {
        const config = (0, config_1.getConfig)();
        const dbPath = path_1.default.join(process.cwd(), config.database.path, config.database.filename);
        db = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database
        });
    }
    return db;
}
async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}
//# sourceMappingURL=sqlite.js.map