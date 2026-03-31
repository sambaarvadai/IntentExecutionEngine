#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../src/api';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Register API routes using custom registration
registerRoutes(app);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Intent Execution Engine API Server`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Graph stats: http://localhost:${PORT}/api/graphs/stats`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /api/graphs/validate - Validate intent');
  console.log('  GET  /api/graphs/:id - Get graph by ID');
  console.log('  PATCH /api/graphs/:id/status - Update graph status');
  console.log('  GET  /api/graphs/stats - Get graph statistics');
  console.log('  GET  /api/apis - List APIs');
  console.log('  GET  /api/apis/:id - Get API by ID');
  console.log('  PATCH /api/apis/:id/status - Update API status');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
