#!/usr/bin/env node
"use strict";
// ------------------------------------------------------------------
// Debug Intent Engine Demo - Detailed Error Analysis
// ------------------------------------------------------------------
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDebugDemo = runDebugDemo;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const intent_1 = require("../intent");
const metadata_1 = require("../schema/metadata");
// ------------------------------------------------------------------
// Debug Configuration
// ------------------------------------------------------------------
async function runDebugDemo() {
    console.log('🔍 Starting Debug Intent Engine Demo...\n');
    // Check environment
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY environment variable is required');
        process.exit(1);
    }
    // Initialize components
    const anthropic = new sdk_1.default({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const schemaMetadata = (0, metadata_1.getSchemaMetadata)();
    const engine = new intent_1.IntentEngine(anthropic);
    console.log('📋 Database Schema:');
    console.log(JSON.stringify(schemaMetadata, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');
    // ------------------------------------------------------------------
    // Debug Test Case - Simple Real Execution
    // ------------------------------------------------------------------
    const testCase = {
        name: 'Debug Real Execution',
        prompt: 'Show me the first 3 customers',
        options: { dryRun: false, allowParallel: false }
    };
    console.log(`🧪 Debug Test: ${testCase.name}`);
    console.log(`💬 Prompt: "${testCase.prompt}"`);
    console.log(`⚙️  Options: ${JSON.stringify(testCase.options)}`);
    console.log('\n⏳ Processing...');
    try {
        const startTime = Date.now();
        const result = await engine.execute({
            prompt: testCase.prompt,
            options: testCase.options,
            context: {
                requestId: 'debug-test',
                timestamp: new Date(),
                api: {
                    id: 'debug-api',
                    route: '/debug',
                    method: 'GET',
                    planId: 'debug-plan',
                    status: 'ACTIVE',
                    label: 'Debug API',
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                incomingParams: {},
                user: {
                    id: 'debug-user',
                    roles: ['user'],
                    permissions: ['read']
                }
            }
        });
        const totalTime = Date.now() - startTime;
        console.log('✅ Graph Generation Success!');
        console.log(`⏱️  Total Time: ${totalTime}ms`);
        console.log(`🔄 Generation: ${result.generationMs}ms`);
        console.log(`⚡ Execution: ${result.executionMs}ms`);
        console.log('\n📊 Generated Graph:');
        console.log(`   ID: ${result.graph.id}`);
        console.log(`   Label: ${result.graph.label}`);
        console.log(`   Entry Node: ${result.graph.entryNode}`);
        console.log(`   Nodes: ${result.graph.nodes.length}`);
        console.log(`   Edges: ${result.graph.edges.length}`);
        console.log('\n🔍 Detailed Node Analysis:');
        result.graph.nodes.forEach((node, idx) => {
            console.log(`\n   ${idx + 1}. ${node.type}: ${node.label || node.id}`);
            console.log(`      ID: ${node.id}`);
            if (node.type === 'query') {
                const queryNode = node;
                console.log(`      Entity: ${queryNode.plan?.entity || 'unknown'}`);
                console.log(`      Needs DB: ${queryNode.plan?.needsDb || 'unknown'}`);
                console.log(`      Select: ${JSON.stringify(queryNode.plan?.select || [])}`);
                if (queryNode.plan?.where) {
                    console.log(`      Where: ${JSON.stringify(queryNode.plan?.where)}`);
                }
                if (queryNode.plan?.limit) {
                    console.log(`      Limit: ${queryNode.plan?.limit}`);
                }
            }
            else if (node.type === 'transform') {
                const transformNode = node;
                console.log(`      Factory: ${transformNode.factory || 'unknown'}`);
                console.log(`      Has Transform Function: ${typeof transformNode.transform === 'function'}`);
                if (transformNode.params) {
                    console.log(`      Params: ${JSON.stringify(transformNode.params, null, 6)}`);
                }
            }
            else if (node.type === 'condition') {
                const conditionNode = node;
                console.log(`      Factory: ${conditionNode.factory || 'unknown'}`);
                console.log(`      Has Transform Function: ${typeof conditionNode.transform === 'function'}`);
                if (conditionNode.params) {
                    console.log(`      Params: ${JSON.stringify(conditionNode.params, null, 6)}`);
                }
            }
            else if (node.type === 'notify') {
                const notifyNode = node;
                console.log(`      Notify Type: ${notifyNode.notify?.type || 'unknown'}`);
                if (notifyNode.notify?.params) {
                    console.log(`      Notify Params: ${JSON.stringify(notifyNode.notify.params, null, 6)}`);
                }
            }
        });
        console.log('\n🔗 Edge Analysis:');
        result.graph.edges.forEach((edge, idx) => {
            console.log(`   ${idx + 1}. ${edge.from} → ${edge.to}`);
        });
        console.log('\n🎯 Execution Results:');
        console.log(`   Success: ${result.result.success}`);
        console.log(`   Graph ID: ${result.result.graphId}`);
        console.log(`   Total Execution Time: ${result.result.totalExecutionTime}ms`);
        console.log(`   Node Results Count: ${result.result.nodeResults.size}`);
        if (!result.result.success) {
            console.log(`   ❌ Failed Node: ${result.result.failedNode || 'unknown'}`);
            console.log(`   Final Output: ${JSON.stringify(result.result.finalOutput, null, 2)}`);
        }
        console.log('\n📊 Node-by-Node Execution Results:');
        for (const [nodeId, nodeResult] of result.result.nodeResults.entries()) {
            console.log(`\n   Node: ${nodeId}`);
            console.log(`   Success: ${nodeResult.success}`);
            console.log(`   Execution Time: ${nodeResult.executionTime}ms`);
            if (!nodeResult.success) {
                console.log(`   ❌ Error: ${nodeResult.error || 'unknown error'}`);
            }
            if (nodeResult.data) {
                console.log(`   Data Type: ${typeof nodeResult.data}`);
                if (typeof nodeResult.data === 'object' && nodeResult.data !== null) {
                    if ('rows' in nodeResult.data) {
                        console.log(`   Rows: ${nodeResult.data.rows?.length || 0}`);
                        console.log(`   Fields: ${nodeResult.data.fields?.join(', ') || 'none'}`);
                    }
                }
            }
        }
    }
    catch (error) {
        console.log('❌ Error!');
        console.log('Error Type:', error instanceof Error ? error.constructor.name : 'Unknown');
        console.log('Error Message:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && 'details' in error) {
            console.log('\n📋 Error Details:');
            console.log(JSON.stringify(error.details, null, 2));
        }
        if (error instanceof Error && 'rawText' in error) {
            console.log('\n📄 Raw LLM Response:');
            console.log(error.rawText);
        }
        if (error instanceof Error) {
            console.log('\n🔍 Stack Trace:');
            console.log(error.stack);
        }
    }
    console.log('\n🎉 Debug Demo Complete!\n');
}
// ------------------------------------------------------------------
// Run Debug Demo
// ------------------------------------------------------------------
if (require.main === module) {
    runDebugDemo().catch(console.error);
}
//# sourceMappingURL=debug-intent-demo.js.map