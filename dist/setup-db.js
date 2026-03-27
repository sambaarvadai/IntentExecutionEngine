#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const init_1 = require("./db/init");
// Load environment variables
dotenv_1.default.config();
async function setupDatabase() {
    console.log('🔧 Database Setup - NL2DB Prototype');
    console.log('=====================================');
    try {
        console.log('🗄️  Initializing database...');
        await (0, init_1.initializeDatabase)();
        console.log('✅ Database setup complete!\n');
        console.log('You can now run the main application with: npm run dev');
    }
    catch (error) {
        console.error('💥 Database setup failed:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
// Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase().catch((error) => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=setup-db.js.map