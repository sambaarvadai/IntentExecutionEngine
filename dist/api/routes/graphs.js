"use strict";
// ------------------------------------------------------------------
// Graph API Routes
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphRouter = void 0;
exports.createRouter = createRouter;
const store_1 = require("../../graph/store");
const runtime_1 = require("../../graph/runtime");
// ------------------------------------------------------------------
// Simple Router Implementation
// ------------------------------------------------------------------
function createRouter() {
    const routes = new Map();
    return {
        get(path, handler) {
            routes.set(`GET:${path}`, { method: 'GET', handler });
        },
        patch(path, handler) {
            routes.set(`PATCH:${path}`, { method: 'PATCH', handler });
        },
        post(path, handler) {
            routes.set(`POST:${path}`, { method: 'POST', handler });
        },
        routes
    };
}
// ------------------------------------------------------------------
// Graph Router
// ------------------------------------------------------------------
exports.graphRouter = createRouter();
// GET /graphs
exports.graphRouter.get('/graphs', async (req, res) => {
    try {
        const { status, limit, offset, q } = req.query || {};
        const graphs = await store_1.graphRepository.query({
            status: status,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
            promptContains: q
        });
        // Get total count (query without limit/offset)
        const totalGraphs = await store_1.graphRepository.query({
            status: status,
            promptContains: q
        });
        res.json({ graphs, total: totalGraphs.length });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// GET /graphs/stats
exports.graphRouter.get('/graphs/stats', async (req, res) => {
    try {
        const stats = await store_1.graphRepository.stats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// GET /graphs/:id
exports.graphRouter.get('/graphs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const graph = await store_1.graphRepository.findById(id);
        if (!graph) {
            return res.status(404).json({ error: 'Graph not found' });
        }
        res.json(graph);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// PATCH /graphs/:id/status
exports.graphRouter.patch('/graphs/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, approvedBy, approvalNote } = req.body;
        // Validate status
        const validStatuses = ['draft', 'approved', 'rejected', 'deprecated'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Must be one of: draft, approved, rejected, deprecated'
            });
        }
        const updatedGraph = await store_1.graphRepository.updateStatus({
            id,
            status,
            approvedBy,
            approvalNote
        });
        res.json(updatedGraph);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Graph not found' });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// POST /graphs/:id/execute
exports.graphRouter.post('/graphs/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch stored graph by id
        const storedGraph = await store_1.graphRepository.findById(id);
        if (!storedGraph) {
            return res.status(404).json({ error: 'Graph not found' });
        }
        // Check if graph is approved
        if (storedGraph.status !== 'approved') {
            return res.status(403).json({
                error: 'Graph must be approved before execution'
            });
        }
        // Deserialize graphJson to ExecutionGraph
        const graph = JSON.parse(storedGraph.graphJson);
        // Execute graph using GraphRuntime
        const runtime = new runtime_1.GraphRuntime();
        const result = await runtime.execute(graph, req.body.options);
        // Increment usage count
        await store_1.graphRepository.incrementUsage(id);
        res.json(result);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Graph not found' });
        }
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// Export the router for registration
exports.default = exports.graphRouter;
//# sourceMappingURL=graphs.js.map