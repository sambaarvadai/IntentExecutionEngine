import dotenv from 'dotenv';
import { getDatabase } from './db/sqlite';
import { interpretUserRequest } from './llm';
import { executePlan } from './execution/run';
import { AnyPlan, ExecutionResult, QueryResult } from './plans/types';
import { formatResponse, reframeResponse } from './response';
import { closeDatabase } from './db/sqlite';
import { buildQueryPipeline } from './plans';
import { AnthropicAdapter } from './plans';
import { getConfig } from './config';
import { executeCompiledQuery } from './execution';

// Load environment variables
dotenv.config();

async function main(): Promise<void> {
  console.log('🤖 NL2DB Prototype - Natural Language to Database Engine');
  console.log('=========================================================');
  
  try {
    // Connect to database (assumes database is already initialized)
    
    console.log('� Connecting to database...');
    await getDatabase();
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
        const userInput = await new Promise<string>((resolve) => {
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
        
        const config = getConfig();
        
        // Choose execution path based on pipeline configuration
        let result;
        let pipelineResult = null;
        if (config.pipeline.enabled) {
          console.log('🔧 Using enhanced query pipeline with self-correction...');
          const adapter = new AnthropicAdapter();
          pipelineResult = await buildQueryPipeline(userInput, adapter);
          
          // Check if this is a conversational plan
          if (pipelineResult.compiled.sql === '') {
            result = { success: true, data: "I'm here to help you query the database. You can ask me about customers, orders, and perform various analyses." };
          } else {
            // Execute compiled query directly
            result = await executeCompiledQuery(pipelineResult.compiled);
          }
        } else {
          console.log('📝 Using standard query interpretation...');
          // Interpret user request
          const plan = await interpretUserRequest(userInput);
          
          // Execute the plan
          result = await executePlan(plan);
        }
        
        // Format and display response
        let response = formatResponse(result);
        
        // Apply response reframing if enabled
        if (config.pipeline.enableResponseReframing && result.success && result.data) {
          try {
            const sql = config.pipeline.enabled && pipelineResult ? 
              pipelineResult.compiled.sql : 
              (result.data as QueryResult).rows ? 'Query executed' : undefined;
            
            response = await reframeResponse(userInput, result.data, sql);
          } catch (error) {
            console.warn('Response reframing failed, using formatted response:', error);
            // Keep original formatted response
          }
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
