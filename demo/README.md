# Demo Scripts

This directory contains demo scripts for testing the Intent Execution Engine API.

## Files

- `server.ts` - Express web server that hosts the API
- `live-test.ts` - Automated test script that validates the full API + graph lifecycle

## Quick Start

### 1. Start the API Server

```bash
npm run server
```

The server will start on `http://localhost:3000` by default.

### 2. Run the Live Test

In a separate terminal:

```bash
npm run demo
```

Or with a custom base URL:

```bash
BASE_URL=http://localhost:3001 npm run demo
```

## Test Steps

The `live-test.ts` script performs the following steps:

1. **POST /api/graphs/validate** - Validate intent "Show me all customers from Chennai"
2. **GET /api/graphs/:id** - Retrieve the created graph details
3. **PATCH /api/graphs/:id/status** - Approve the graph
4. **Wait 500ms** - Allow fire-and-forget indexing to complete
5. **POST /api/graphs/validate** - Same prompt (should hit cache)
6. **POST /api/graphs/validate** - Semantically similar prompt "List Chennai customers"
7. **POST /api/graphs/validate** - Different intent "Show total revenue by product category"
8. **GET /api/graphs/stats** - Get graph statistics

## API Endpoints

- `POST /api/graphs/validate` - Validate intent and generate graph
- `GET /api/graphs/:id` - Get graph by ID
- `PATCH /api/graphs/:id/status` - Update graph status
- `GET /api/graphs/stats` - Get graph statistics
- `GET /api/apis` - List APIs
- `GET /api/apis/:id` - Get API by ID
- `PATCH /api/apis/:id/status` - Update API status
- `GET /health` - Health check

## Environment Variables

- `PORT` - Server port (default: 3000)
- `BASE_URL` - API base URL for demo script (default: http://localhost:3000)
- `ANTHROPIC_API_KEY` - Required for intent validation
- `VOYAGE_API_KEY` - Required for semantic search
- `CHROMA_URL` - ChromaDB URL for vector storage (default: http://localhost:8000)

## Troubleshooting

### Server won't start

Make sure all dependencies are installed:

```bash
npm install
```

### Demo script fails with connection error

Ensure the server is running and accessible:

```bash
curl http://localhost:3000/health
```

### Intent validation fails

Check that your environment variables are set:

```bash
echo $ANTHROPIC_API_KEY
echo $VOYAGE_API_KEY
```
