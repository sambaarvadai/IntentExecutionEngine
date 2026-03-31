// src/demo/runAPI.ts

import { AnthropicAdapter } from '../plans/anthropicAdapter';
import { APIGenerator } from '../api/generator';
import { apiRegistry } from '../api/registry';
import { planStore } from '../plans/store';
import { apiHandler } from '../api/handler';
import { IntentEngine } from '../intent';
import Anthropic from '@anthropic-ai/sdk';

async function demo(userPrompt: string) {
  console.log('\n═══════════════════════════════════════');
  console.log(`PROMPT: "${userPrompt}"`);
  console.log('═══════════════════════════════════════\n');

  const llm = new AnthropicAdapter();
  
  // Initialize IntentEngine with Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const intentEngine = new IntentEngine(anthropic);
  const generator = new APIGenerator(intentEngine);

  // ── Step 1: Generate API from intent ──────────────────────────
  console.log('① Generating API from intent...');
  const { api, graph, confidence } = await generator.generateAPI(
    { intent: userPrompt }
  );
  console.log(`   Route    : ${api.method} ${api.route}`);
  console.log(`   Label    : ${api.label}`);
  console.log(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
  
  // Extract primary plan from graph
  const plan = graph.nodes.find(n => n.type === 'query')?.plan;
  
  if (plan) {
    console.log(`   Plan     :`, JSON.stringify(plan, null, 2));
  }

  // ── Step 2: Skip registration for conversational plans ───────────────
  if (!plan?.needsDb) {
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
  const savedPlan = await planStore.save(plan);
  const registeredAPI = await apiRegistry.register({
    ...api,
    planId: savedPlan.id,
    status: 'ACTIVE',   // skip DRAFT for demo purposes
  });
  console.log(`   Plan ID  : ${savedPlan.id}`);
  console.log(`   API ID   : ${registeredAPI.id}`);
  console.log(`   Status   : ${registeredAPI.status}`);

  // ── Step 4: Execute through the handler ───────────────────────
  console.log('\n③ Executing request through handler...');
  const response = await apiHandler.handleRequest({
    apiId: registeredAPI.id,
    params: {},
    headers: {},
  });

  // ── Step 5: Show result ───────────────────────────────────────
  console.log('\n④ Result:');
  if (response.success) {
    console.log(JSON.stringify(response.data, null, 2));
  } else {
    console.log('   ERROR:', response.error);
  }

  console.log('\n───────────────────────────────────────');
  console.log(`Execution time: ${response.metadata?.executionTime}ms`);
  console.log(`Request ID    : ${response.metadata?.requestId}`);
}

// ── Run it ────────────────────────────────────────────────────────
const prompt = process.argv[2] || 'Show all customers';

demo(prompt).catch(console.error);
