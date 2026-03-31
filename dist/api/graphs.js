"use strict";
// ------------------------------------------------------------------
// Graph API Routes
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGraphsList = handleGraphsList;
exports.handleGraphStats = handleGraphStats;
exports.handleGraphById = handleGraphById;
exports.handleUpdateGraphStatus = handleUpdateGraphStatus;
exports.handleExecuteGraph = handleExecuteGraph;
exports.registerGraphHandlers = registerGraphHandlers;
const store_1 = require("../graph/store");
const runtime_1 = require("../graph/runtime");
// ------------------------------------------------------------------
// Route Handlers
// ------------------------------------------------------------------
async function handleGraphsList(params) {
    const graphs = await store_1.graphRepository.query({
        status: params.status,
        limit: params.limit,
        offset: params.offset,
        promptContains: params.q
    });
    // Get total count for pagination
    const stats = await store_1.graphRepository.stats();
    return {
        success: true,
        data: {
            graphs,
            total: stats.total
        }
    };
}
async function handleGraphStats() {
    const stats = await store_1.graphRepository.stats();
    return {
        success: true,
        data: stats
    };
}
async function handleGraphById(id) {
    try {
        const graph = await store_1.graphRepository.findById(id);
        if (!graph) {
            return {
                success: false,
                error: `Graph not found: ${id}`
            };
        }
        return {
            success: true,
            data: graph
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function handleUpdateGraphStatus(id, body) {
    try {
        // Validate status
        const validStatuses = ['draft', 'approved', 'rejected', 'deprecated'];
        if (!validStatuses.includes(body.status)) {
            return {
                success: false,
                error: `Invalid status: ${body.status}. Must be one of: ${validStatuses.join(', ')}`
            };
        }
        const result = await store_1.graphRepository.updateStatus({
            id,
            status: body.status,
            approvedBy: body.approvedBy,
            approvalNote: body.approvalNote
        });
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function handleExecuteGraph(id) {
    try {
        // Fetch stored graph
        const storedGraph = await store_1.graphRepository.findById(id);
        if (!storedGraph) {
            return {
                success: false,
                error: `Graph not found: ${id}`
            };
        }
        // Check if graph is approved
        if (storedGraph.status !== 'approved') {
            return {
                success: false,
                error: 'Graph must be approved before execution'
            };
        }
        // Deserialize graph JSON to ExecutionGraph
        const graph = JSON.parse(storedGraph.graphJson);
        // Execute graph
        const runtime = new runtime_1.GraphRuntime();
        const result = await runtime.execute(graph, {
            maxParallelNodes: 1,
            dryRun: false
        });
        // Increment usage count
        await store_1.graphRepository.incrementUsage(id);
        return {
            success: true,
            data: result
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// ------------------------------------------------------------------
// Route Registration Helper
// ------------------------------------------------------------------
function registerGraphHandlers() {
    // This function can be called to register the graph handlers
    // with the existing API registry system
    return {
        '/graphs': handleGraphsList,
        '/graphs/stats': handleGraphStats,
        '/graphs/:id': handleGraphById,
        '/graphs/:id/status': handleUpdateGraphStatus,
        '/graphs/:id/execute': handleExecuteGraph
    };
}
//# sourceMappingURL=graphs.js.map