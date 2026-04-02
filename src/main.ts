import dotenv from 'dotenv';
import { getDatabase } from './db/sqlite';
import { formatResponse, reframeResponse } from './response';
import { closeDatabase } from './db/sqlite';
import { getConfig } from './config';
import Anthropic from '@anthropic-ai/sdk';
import { IntentEngine } from './intent';
import { IntentResult } from './intent/types';
import { createSearchService } from './search';
import { GraphRuntime } from './graph/runtime';
import { SessionStore } from './session/store';
import { graphRepository } from './graph/store';
import { randomUUID } from 'crypto';

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

    function askQuestion(question: string): Promise<string> {
      return new Promise(resolve => {
        rl.question(question, resolve);
      });
    }

    async function previewAndConfirm(
      prompt: string, 
      sessionId: string
    ): Promise<IntentResult | null> {
      
      const result = await engine.execute({
        prompt,
        sessionId,
        options: { preview: true }
      });
      
      // If it's a conversational intent, it's already executed
      if (result.status === 'success' && !result.storedGraphId) {
        // Conversational response - display and return immediately
        console.log(`🤖: ${result.result?.finalOutput || 'Response received'}\n`);
        return null;  // Don't continue the main loop
      }
      
      console.log('\n📋 Here\'s what I understood:');
      console.log('─'.repeat(50));
      console.log(result.intentSummary?.plainText ?? prompt);
      console.log('─'.repeat(50));
      console.log('  [yes] Run it   [no] Cancel   [or refine your query]');
      
      const answer = (await askQuestion('Your choice: ')).trim();
      const answerLower = answer.toLowerCase();
      
      if (answerLower === 'no' || answerLower === 'n') {
        console.log('❌ Cancelled.\n');
        return null;
      }
      
      if (answerLower === 'yes' || answerLower === 'y') {
        return result;  // caller executes this
      }
      
      // Refinement — recurse with the new prompt
      const refinedPrompt = answer.replace(/^refine[,:\s]+/i, '').trim();
      console.log('🔄 Refining...\n');
      return previewAndConfirm(refinedPrompt, sessionId);
    }
    
    while (true) {
      try {
        let userInput = await new Promise<string>((resolve) => {
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
        
        // Preview and confirm before execution
        const confirmed = await previewAndConfirm(userInput, cliSessionId);
        if (!confirmed) continue;
        
        // Execute confirmed.storedGraphId
        console.log('🔄 Processing...');
        let intentResult;
        if (confirmed.storedGraphId && confirmed.status === 'preview') {
          // Execute the pre-compiled graph — no second LLM call
          const runtime = new GraphRuntime();
          const graphRecord = await graphRepository.findById(confirmed.storedGraphId);
          if (graphRecord) {
            const graph = JSON.parse(graphRecord.graphJson);
            const execResult = await runtime.execute(graph);
            
            // Record turn in session
            if (cliSessionId && execResult.success) {
              const rows = extractRows(execResult.finalOutput);
              const turn = {
                turnId: randomUUID(),
                timestamp: Date.now(),
                rawQuery: userInput,
                intentSummary: graph.intentSummary ?? { action: 'Query', subject: 'results' },
                intent: { tables: [], filters: [] },
                resultShape: {
                  rowCount: rows.length,
                  columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                  primaryTable: graph.nodes[0]?.plan?.entity ?? 'unknown',
                  primaryKeyValues: rows.map((r: any) => r['id']).filter(Boolean).slice(0, 100),
                  sampleRows: rows.slice(0, 3)
                }
              };
              await sessionStore.appendTurn(cliSessionId, turn);
            }
            
            intentResult = { ...confirmed, result: execResult };
          } else {
            intentResult = confirmed;  // fallback if no stored graph
          }
        } else {
          intentResult = confirmed;  // fallback if no stored graph
        }

        const result = intentResult.result;
        
        const config = getConfig();
        
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

function extractRows(output: any): Record<string, unknown>[] {
  if (!output) return [];
  if (Array.isArray(output)) return output;
  if (output?.rows && Array.isArray(output.rows)) return output.rows;
  return [];
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
