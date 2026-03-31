"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const sqlite_1 = require("./db/sqlite");
const response_1 = require("./response");
const sqlite_2 = require("./db/sqlite");
const config_1 = require("./config");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const intent_1 = require("./intent");
// Load environment variables
dotenv_1.default.config();
async function main() {
    console.log('🤖 NL2DB Prototype - Natural Language to Database Engine');
    console.log('=========================================================');
    try {
        // Connect to database (assumes database is already initialized)
        console.log('🔌 Connecting to database...');
        await (0, sqlite_1.getDatabase)();
        console.log('✅ Database ready\n');
        // Initialize services
        const anthropic = new sdk_1.default({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        // const searchService = process.env.VOYAGE_API_KEY
        //   ? createSearchService()
        //   : undefined;
        // if (searchService) await searchService.init();
        const engine = new intent_1.IntentEngine(anthropic);
        // console.log(`🔍 Semantic cache: ${searchService ? 'enabled' : 'disabled'}`);
        console.log(`🧠 Intent engine: ready\n`);
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
                // Execute using the full pipeline
                let intentResult;
                try {
                    intentResult = await engine.execute({
                        prompt: userInput,
                        options: { dryRun: false, allowParallel: true }
                    });
                }
                catch (error) {
                    // surface IntentParseError clearly
                    throw error;
                }
                // Log whether this was a cache hit
                if (intentResult.cacheHit) {
                    console.log(`⚡ Cache hit (score: ${intentResult.cacheScore?.toFixed(3)})`);
                }
                else {
                    console.log(`� Generated new graph in ${intentResult.generationMs}ms`);
                    console.log(`💾 Stored as draft: ${intentResult.storedGraphId}`);
                }
                const result = intentResult.result;
                // Extract rows from graph result for reframing
                const data = result.finalOutput;
                let response;
                if (config.pipeline.enableResponseReframing && data) {
                    try {
                        response = await (0, response_1.reframeResponse)(userInput, data, undefined);
                    }
                    catch {
                        response = JSON.stringify(data, null, 2);
                    }
                }
                else {
                    response = result.success
                        ? JSON.stringify(data, null, 2)
                        : `Error: ${result.failedNode ?? 'execution failed'}`;
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