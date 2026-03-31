#!/usr/bin/env ts-node
"use strict";
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
async function post(url, body) {
    const response = await fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return response.json();
}
async function get(url) {
    const response = await fetch(`${BASE_URL}${url}`);
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return response.json();
}
async function patch(url, body) {
    const response = await fetch(`${BASE_URL}${url}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return response.json();
}
function log(step, data) {
    console.log(`\n${step}`);
    console.log(JSON.stringify(data, null, 2));
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
    console.log('🚀 Starting Intent Execution Engine Live Test');
    console.log(`📡 Base URL: ${BASE_URL}`);
    try {
        // Check server health first
        console.log('\n📍 Step 0: Health check');
        const health = await get('/health');
        log('✅ Server Health:', health);
        // Step 1: POST /graphs/validate
        console.log('\n📍 Step 1: Validate intent "Show me all customers from Chennai"');
        const validation1 = await post('/api/graphs/validate', {
            prompt: "Show me all customers from Chennai"
        });
        log('✅ Validation Response:', {
            graphId: validation1.graphId,
            nodeCount: validation1.nodeCount,
            generationMs: validation1.generationMs
        });
        const graphId = validation1.graphId;
        // Step 2: GET /graphs/:graphId
        console.log('\n📍 Step 2: Get graph details');
        const graph = await get(`/api/graphs/${graphId}`);
        log('✅ Graph Details:', {
            status: graph.status,
            prompt: graph.prompt,
            nodeCount: JSON.parse(graph.graphJson).nodes.length
        });
        // Step 3: PATCH /graphs/:graphId/status
        console.log('\n📍 Step 3: Approve graph');
        const statusUpdate = await patch(`/api/graphs/${graphId}/status`, {
            status: "approved",
            approvedBy: "test-user"
        });
        log('✅ Status Update:', {
            newStatus: statusUpdate.status
        });
        // Step 4: Wait 500ms for indexing
        console.log('\n📍 Step 4: Waiting for indexing...');
        await sleep(500);
        console.log('✅ Wait complete');
        // Step 5: POST /graphs/validate (same prompt - should hit cache)
        console.log('\n📍 Step 5: Validate same intent (should hit cache)');
        const validation2 = await post('/api/graphs/validate', {
            prompt: "Show me all customers from Chennai"
        });
        log('✅ Cache Hit Response:', {
            cacheHit: validation2.cacheHit || false,
            cacheScore: validation2.cacheScore || 0,
            generationMs: validation2.generationMs
        });
        // Step 6: POST /graphs/validate (semantically similar prompt)
        console.log('\n📍 Step 6: Validate semantically similar intent');
        const validation3 = await post('/api/graphs/validate', {
            prompt: "List Chennai customers"
        });
        log('✅ Semantic Similar Response:', {
            cacheHit: validation3.cacheHit || false,
            cacheScore: validation3.cacheScore || 0
        });
        // Step 7: POST /graphs/validate (different intent)
        console.log('\n📍 Step 7: Validate different intent');
        const validation4 = await post('/api/graphs/validate', {
            prompt: "Show total revenue by product category"
        });
        log('✅ Different Intent Response:', {
            cacheHit: validation4.cacheHit || false,
            cacheScore: validation4.cacheScore || 0
        });
        // Step 8: GET /graphs/stats
        console.log('\n📍 Step 8: Get graph statistics');
        const stats = await get('/api/graphs/stats');
        log('✅ Graph Statistics:', {
            total: stats.total,
            byStatus: stats.byStatus
        });
        console.log('\n🎉 Live test completed successfully!');
    }
    catch (error) {
        console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
        if (error instanceof Error && error.message.includes('Could not resolve authentication method')) {
            console.log('\n💡 Setup Required:');
            console.log('1. Set ANTHROPIC_API_KEY in your .env file');
            console.log('2. Set VOYAGE_API_KEY in your .env file (for semantic search)');
            console.log('3. Make sure ChromaDB is running on http://localhost:8000');
            console.log('\n📝 .env file example:');
            console.log('ANTHROPIC_API_KEY=your_anthropic_api_key_here');
            console.log('VOYAGE_API_KEY=your_voyage_api_key_here');
            console.log('CHROMA_URL=http://localhost:8000');
        }
        process.exit(1);
    }
}
// Check if server is running
async function checkServer() {
    try {
        await get('/api/graphs/stats');
        return true;
    }
    catch {
        return false;
    }
}
async function startWithServerCheck() {
    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.log('❌ Server is not running at', BASE_URL);
        console.log('Please start the server first.');
        console.log('You may need to create a server file - see the API routes in src/api/routes/');
        process.exit(1);
    }
    await main();
}
// Run the test
if (require.main === module) {
    startWithServerCheck().catch(console.error);
}
//# sourceMappingURL=live-test.js.map