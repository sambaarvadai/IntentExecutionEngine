// src/demo/runAPI-mock.ts
// Demo version that uses mocks instead of real LLM API calls

import { APIGenerator } from '../api/generator';
import { apiRegistry } from '../api/registry';
import { planStore } from '../plans/store';
import { apiHandler } from '../api/handler';
import { LLMAdapter } from '../plans';
import { QueryPlan } from '../plans/types';

// Mock LLM adapter for demo purposes
const mockAdapter: LLMAdapter = {
  async generatePlan(prompt: string): Promise<QueryPlan> {
    // Simple mock logic based on prompt content
    if (prompt.toLowerCase().includes('customers')) {
      if (prompt.toLowerCase().includes('chennai')) {
        return {
          needsDb: true,
          entity: 'customers',
          select: ['customers.*'],
          where: [{ field: 'customers.city', op: '=', value: 'Chennai' }]
        };
      } else if (prompt.toLowerCase().includes('count')) {
        return {
          needsDb: true,
          entity: 'customers',
          aggregate: { type: 'count' }
        };
      } else {
        return {
          needsDb: true,
          entity: 'customers',
          select: ['customers.*']
        };
      }
    } else if (prompt.toLowerCase().includes('orders')) {
      if (prompt.toLowerCase().includes('how many')) {
        return {
          needsDb: true,
          entity: 'orders',
          aggregate: { type: 'count' }
        };
      } else if (prompt.toLowerCase().includes('total') && prompt.toLowerCase().includes('amount')) {
        return {
          needsDb: true,
          entity: 'orders',
          aggregate: { type: 'sum', field: 'amount' },
          join: ['customers'],
          where: [{ field: 'customers.name', op: '=', value: 'Ravi' }]
        };
      } else {
        return {
          needsDb: true,
          entity: 'orders',
          select: ['orders.*']
        };
      }
    } else if (prompt.toLowerCase().includes('hello') || prompt.toLowerCase().includes('hi')) {
      return {
        needsDb: false,
        responseMode: 'conversational'
      } as any;
    }
    
    // Default fallback
    return {
      needsDb: true,
      entity: 'customers',
      select: ['customers.*']
    };
  },
  
  async correctPlan(originalPrompt: string, feedback: string, badPlan: QueryPlan): Promise<QueryPlan> {
    // Return a simple corrected plan
    return {
      needsDb: true,
      entity: 'customers',
      select: ['customers.*']
    };
  }
};

async function demo(userPrompt: string) {
  console.log('\n═══════════════════════════════════════');
  console.log(`PROMPT: "${userPrompt}"`);
  console.log('═══════════════════════════════════════\n');

  const generator = APIGenerator.getInstance();

  // ── Step 1: Generate API from intent ──────────────────────────
  console.log('① Generating API from intent...');
  const { api, plan, confidence } = await generator.generateAPI(
    { intent: userPrompt },
    mockAdapter
  );
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
