"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const sqlite_1 = require("./db/sqlite");
const llm_1 = require("./llm");
const run_1 = require("./execution/run");
const response_1 = require("./response");
const sqlite_2 = require("./db/sqlite");
const plans_1 = require("./plans");
const plans_2 = require("./plans");
const config_1 = require("./config");
const execution_1 = require("./execution");
// Load environment variables
dotenv_1.default.config();
async function main() {
    console.log('🤖 NL2DB Prototype - Natural Language to Database Engine');
    console.log('=========================================================');
    try {
        // Connect to database (assumes database is already initialized)
        console.log('� Connecting to database...');
        await (0, sqlite_1.getDatabase)();
        console.log('✅ Database ready\n');
        // Start chat loop
        console.log('💬 Chat interface ready. Type "exit" to quit.');
        console.log('📝 Supported queries: list customers/orders, filter by name/city, count orders, sum amounts, recent orders\n');
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        while (true) {
            try {
                const userInput = await new Promise((resolve) => {
                    rl.question('You: ', resolve);
                });
                // Check for exit command
                if (userInput.toLowerCase().trim() === 'exit') {
                    console.log('👋 Goodbye!');
                    break;
                }
                // Process empty input
                if (!userInput.trim()) {
                    continue;
                }
                console.log('🔄 Processing...');
                const config = (0, config_1.getConfig)();
                // Choose execution path based on pipeline configuration
                let result;
                let pipelineResult = null;
                if (config.pipeline.enabled) {
                    console.log('🔧 Using enhanced query pipeline with self-correction...');
                    const adapter = new plans_2.AnthropicAdapter();
                    pipelineResult = await (0, plans_1.buildQueryPipeline)(userInput, adapter);
                    // Check if this is a conversational plan
                    if (pipelineResult.compiled.sql === '') {
                        result = { success: true, data: "I'm here to help you query the database. You can ask me about customers, orders, and perform various analyses." };
                    }
                    else {
                        // Execute compiled query directly
                        result = await (0, execution_1.executeCompiledQuery)(pipelineResult.compiled);
                    }
                }
                else {
                    console.log('📝 Using standard query interpretation...');
                    // Interpret user request
                    const plan = await (0, llm_1.interpretUserRequest)(userInput);
                    // Execute the plan
                    result = await (0, run_1.executePlan)(plan);
                }
                // Format and display response
                let response = (0, response_1.formatResponse)(result);
                // Apply response reframing if enabled
                if (config.pipeline.enableResponseReframing && result.success && result.data) {
                    try {
                        const sql = config.pipeline.enabled && pipelineResult ?
                            pipelineResult.compiled.sql :
                            result.data.rows ? 'Query executed' : undefined;
                        response = await (0, response_1.reframeResponse)(userInput, result.data, sql);
                    }
                    catch (error) {
                        console.warn('Response reframing failed, using formatted response:', error);
                        // Keep original formatted response
                    }
                }
                console.log(`🤖: ${response}\n`);
            }
            catch (error) {
                console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
            }
        }
        rl.close();
    }
    catch (error) {
        console.error('💥 Fatal error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    finally {
        // Clean up database connection
        await (0, sqlite_2.closeDatabase)();
    }
}
// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await (0, sqlite_2.closeDatabase)();
    process.exit(0);
});
// Run the application
if (require.main === module) {
    main().catch((error) => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=main.js.map