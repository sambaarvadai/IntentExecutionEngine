#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const api_1 = require("../src/api");
// Load environment variables
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Register API routes using custom registration
(0, api_1.registerRoutes)(app);
// Health check endpoint
app.get('/health', (req, res) => {
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
//# sourceMappingURL=server.js.map