"use strict";
// src/demo/runAPI.ts
Object.defineProperty(exports, "__esModule", { value: true });
const anthropicAdapter_1 = require("../plans/anthropicAdapter");
const generator_1 = require("../api/generator");
const registry_1 = require("../api/registry");
const store_1 = require("../plans/store");
const handler_1 = require("../api/handler");
async function demo(userPrompt) {
    console.log('\n═══════════════════════════════════════');
    console.log(`PROMPT: "${userPrompt}"`);
    console.log('═══════════════════════════════════════\n');
    const llm = new anthropicAdapter_1.AnthropicAdapter();
    const generator = generator_1.APIGenerator.getInstance();
    // ── Step 1: Generate API from intent ──────────────────────────
    console.log('① Generating API from intent...');
    const { api, plan, confidence } = await generator.generateAPI({ intent: userPrompt }, llm);
    console.log(`   Route    : ${api.method} ${api.route}`);
    console.log(`   Label    : ${api.label}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
    console.log(`   Plan     :`, JSON.stringify(plan, null, 2));
    // ── Step 2: Skip registration for conversational plans ───────────────
    if (!plan.needsDb) {
        console.log('\n② Result: Conversational — no API registered');
        console.log('\n④ Result:');
        console.log(JSON.stringify({
            type: 'conversational',
            message: 'This is a conversational response - no database query executed'
        }, null, 2));
        return;
    }
    // ── Step 3: Save plan + register API ──────────────────────────
    console.log('\n② Saving to registry...');
    const savedPlan = await store_1.planStore.save(plan);
    const registeredAPI = await registry_1.apiRegistry.register({
        ...api,
        planId: savedPlan.id,
        status: 'ACTIVE', // skip DRAFT for demo purposes
    });
    console.log(`   Plan ID  : ${savedPlan.id}`);
    console.log(`   API ID   : ${registeredAPI.id}`);
    console.log(`   Status   : ${registeredAPI.status}`);
    // ── Step 4: Execute through the handler ───────────────────────
    console.log('\n③ Executing request through handler...');
    const response = await handler_1.apiHandler.handleRequest({
        apiId: registeredAPI.id,
        params: {},
        headers: {},
    });
    // ── Step 5: Show result ───────────────────────────────────────
    console.log('\n④ Result:');
    if (response.success) {
        console.log(JSON.stringify(response.data, null, 2));
    }
    else {
        console.log('   ERROR:', response.error);
    }
    console.log('\n───────────────────────────────────────');
    console.log(`Execution time: ${response.metadata?.executionTime}ms`);
    console.log(`Request ID    : ${response.metadata?.requestId}`);
}
// ── Run it ────────────────────────────────────────────────────────
const prompt = process.argv[2] || 'Show all customers';
demo(prompt).catch(console.error);
//# sourceMappingURL=runAPI.js.map