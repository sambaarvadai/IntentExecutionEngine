#!/usr/bin/env node

// ------------------------------------------------------------------
// Real-time Intent Engine Demo
// ------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { IntentEngine } from '../intent';
import { getSchemaMetadata } from '../schema/metadata';
import { getConfig } from '../config';

// ------------------------------------------------------------------
// Demo Configuration
// ------------------------------------------------------------------

async function runIntentDemo() {
  console.log('🚀 Starting Intent Engine Demo...\n');

  // Check environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.log('Set it with: export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  // Initialize components
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const schemaMetadata = getSchemaMetadata();
  const engine = new IntentEngine(anthropic);

  console.log('📋 Database Schema:');
  console.log(JSON.stringify(schemaMetadata, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  // ------------------------------------------------------------------
  // Test Cases
  // ------------------------------------------------------------------

  const testCases = [
    {
      name: 'Simple Customer Query',
      prompt: 'Show me all active customers',
      options: { dryRun: true, allowParallel: false }
    },
    {
      name: 'Complex Filter with Transform',
      prompt: 'Find customers who are active and have spent more than $100, then sort them by name and show only their name and email',
      options: { dryRun: true, allowParallel: false }
    },
    {
      name: 'Conditional Logic',
      prompt: 'Check if there are any customers with status VIP, if so send them a notification, otherwise show all regular customers',
      options: { dryRun: true, allowParallel: false }
    },
    {
      name: 'Data Aggregation',
      prompt: 'Group customers by status and count how many customers are in each group',
      options: { dryRun: true, allowParallel: false }
    },
    {
      name: 'Real Execution (Non-Dry Run)',
      prompt: 'Show me the first 3 customers',
      options: { dryRun: false, allowParallel: false }
    }
  ];

  // ------------------------------------------------------------------
  // Run Tests
  // ------------------------------------------------------------------

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 Test ${i + 1}: ${testCase.name}`);
    console.log(`💬 Prompt: "${testCase.prompt}"`);
    console.log(`⚙️  Options: ${JSON.stringify(testCase.options)}`);
    console.log('\n⏳ Processing...');

    try {
      const startTime = Date.now();
      const result = await engine.execute({
        prompt: testCase.prompt,
        options: testCase.options,
        context: {
          requestId: `demo-${i + 1}`,
          timestamp: new Date(),
          api: {
            id: 'demo-api',
            route: '/demo',
            method: 'GET' as const,
            planId: 'demo-plan',
            status: 'ACTIVE' as const,
            label: 'Demo API',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          incomingParams: {},
          user: {
            id: 'demo-user',
            roles: ['user'],
            permissions: ['read']
          }
        }
      });
      const totalTime = Date.now() - startTime;

      console.log('✅ Success!');
      console.log(`⏱️  Total Time: ${totalTime}ms`);
      console.log(`🔄 Generation: ${result.generationMs}ms`);
      console.log(`⚡ Execution: ${result.executionMs}ms`);
      
      console.log('\n📊 Generated Graph:');
      console.log(`   ID: ${result.graph.id}`);
      console.log(`   Label: ${result.graph.label}`);
      console.log(`   Entry Node: ${result.graph.entryNode}`);
      console.log(`   Nodes: ${result.graph.nodes.length}`);
      console.log(`   Edges: ${result.graph.edges.length}`);

      console.log('\n🔍 Node Details:');
      result.graph.nodes.forEach((node, idx) => {
        console.log(`   ${idx + 1}. ${node.type}: ${node.label || node.id}`);
        if (node.type === 'query') {
          console.log(`      Entity: ${(node as any).plan?.entity || 'unknown'}`);
        } else if (node.type === 'transform') {
          console.log(`      Factory: ${(node as any).factory || 'unknown'}`);
        } else if (node.type === 'condition') {
          console.log(`      Factory: ${(node as any).factory || 'unknown'}`);
        }
      });

      if (testCase.options.dryRun) {
        console.log('\n🔬 Dry Run Mode - No actual database execution');
      } else {
        console.log('\n🎯 Real Execution Results:');
        console.log(`   Success: ${result.result.success}`);
        console.log(`   Final Output: ${JSON.stringify(result.result.finalOutput, null, 2)}`);
        console.log(`   Node Results: ${result.result.nodeResults.size} nodes executed`);
        
        if (!result.result.success) {
          console.log(`   Failed Node: ${result.result.failedNode || 'unknown'}`);
        }
      }

    } catch (error) {
      console.log('❌ Error!');
      console.log('Error Type:', error instanceof Error ? error.constructor.name : 'Unknown');
      console.log('Error Message:', error instanceof Error ? error.message : String(error));
      
      if (error instanceof Error && 'details' in error) {
        console.log('Error Details:', JSON.stringify((error as any).details, null, 2));
      }
      
      if (error instanceof Error && 'rawText' in error) {
        console.log('Raw LLM Response:', (error as any).rawText);
      }
    }

    console.log('\n' + '-'.repeat(60));
  }

  console.log('\n🎉 Demo Complete!\n');
}

// ------------------------------------------------------------------
// Run Demo
// ------------------------------------------------------------------

if (require.main === module) {
  runIntentDemo().catch(console.error);
}

export { runIntentDemo };
