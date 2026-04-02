import dotenv from 'dotenv';
import { getDatabase } from './db/sqlite';
import { formatResponse, reframeResponse } from './response';
import { closeDatabase } from './db/sqlite';
import { getConfig } from './config';
import Anthropic from '@anthropic-ai/sdk';
import { IntentEngine } from './intent';
import { createSearchService } from './search';
import { GraphRuntime } from './graph/runtime';
import { SessionStore } from './session/store';

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  console.log('🤖 NL2DB Prototype - Natural Language to Database Engine');
  console.log('=========================================================');
  
  try {
    // Connect to database (assumes database is already initialized)
    
    console.log('🔌 Connecting to database...');
    await getDatabase();
    console.log('✅ Database ready\n');
    
    // Initialize services
    const anthropic = new Anthropic({ 
      apiKey: process.env.ANTHROPIC_API_KEY 
    });
    
    // const searchService = process.env.VOYAGE_API_KEY
    //   ? createSearchService()
    //   : undefined;
    
    // if (searchService) await searchService.init();
    
    const db = await getDatabase();
    const sessionStore = new SessionStore(db);
    const engine = new IntentEngine(anthropic, sessionStore);
    
    // Generate or use existing session ID for CLI session
    const cliSessionId = 'cli-session-' + (process.env.USER || 'default');
    
    // console.log(`🔍 Semantic cache: ${searchService ? 'enabled' : 'disabled'}`);
    console.log(`🧠 Intent engine: ready`);
    console.log(`📝 Session ID: ${cliSessionId}\n`);
    
    // Start chat loop
    console.log('💬 Chat interface ready. Type "exit" to quit.');
    console.log('📝 Supported queries: list customers/orders, filter by name/city, count orders, sum amounts, recent orders');
    console.log('🔄 Session context enabled - conversation history maintained');
    console.log('🛠️  Commands: "clear session", "session info", "exit"\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    while (true) {
      try {
        const userInput = await new Promise<string>((resolve) => {
          rl.question('You: ', resolve);
        });
        
        // Check for exit command
        if (userInput.toLowerCase().trim() === 'exit') {
          console.log('👋 Goodbye!');
          break;
        }
        
        // Check for session management commands
        if (userInput.toLowerCase().trim() === 'clear session') {
          await sessionStore.delete(cliSessionId);
          console.log('🗑️  Session cleared - conversation history reset');
          continue;
        }
        
        if (userInput.toLowerCase().trim() === 'session info') {
          const session = await sessionStore.get(cliSessionId);
          if (session) {
            console.log(`📊 Session: ${cliSessionId}`);
            console.log(`   Turns: ${session.turns.length}`);
            console.log(`   User terms: ${Object.keys(session.userDefinedTerms).length}`);
            console.log(`   Last activity: ${new Date(session.turns[session.turns.length - 1]?.timestamp || 0).toLocaleString()}`);
          } else {
            console.log('📊 No active session');
          }
          continue;
        }
        
        // Process empty input
        if (!userInput.trim()) {
          continue;
        }
        
        console.log('🔄 Processing...');
        
        const config = getConfig();
        
        // Execute using the full pipeline
        let intentResult;
        try {
          intentResult = await engine.execute({
            prompt: userInput,
            sessionId: cliSessionId,
            options: { dryRun: false, allowParallel: true }
          });
        } catch (error) {
          // surface IntentParseError clearly
          throw error;
        }

        // Log whether this was a cache hit
        if (intentResult.cacheHit) {
          console.log(`⚡ Cache hit (score: ${intentResult.cacheScore?.toFixed(3)})`);
        } else {
          console.log(`� Generated new graph in ${intentResult.generationMs}ms`);
          console.log(`💾 Stored as draft: ${intentResult.storedGraphId}`);
        }

        const result = intentResult.result;
        
        // Extract rows from graph result for reframing
        const data = result.finalOutput;
        
        let response;
        if (config.pipeline.enableResponseReframing && data) {
          try {
            response = await reframeResponse(userInput, data, undefined);
          } catch {
            response = JSON.stringify(data, null, 2);
          }
        } else {
          response = result.success 
            ? JSON.stringify(data, null, 2)
            : `Error: ${result.failedNode ?? 'execution failed'}`;
        }
        
        console.log(`🤖: ${response}\n`);
        
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    }
    
    rl.close();
    
  } catch (error) {
    console.error('💥 Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    // Clean up database connection
    await closeDatabase();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}
