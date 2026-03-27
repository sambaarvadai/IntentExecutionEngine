#!/usr/bin/env node

// Simple runner for the intent demo
require('dotenv').config();

async function runDemo() {
  try {
    await require('./intent-demo.js').runIntentDemo();
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

runDemo();
