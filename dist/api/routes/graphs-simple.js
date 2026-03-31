"use strict";
// ------------------------------------------------------------------
// Graph Management API Routes
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphRoutes = void 0;
const store_1 = require("../../graph/store");
// Custom router implementation
const graphRoutes = {
    // GET /graphs - Query stored graphs with optional filtering
    async getGraphs(req, res) {
        try {
            // For now, we'll implement basic query support
            // In a real implementation, you'd parse query params from req.params
            const query = {};
            const graphs = await store_1.graphRepository.query(query);
            const stats = await store_1.graphRepository.stats();
            const response = {
                success: true,
                data: {
                    graphs,
                    total: stats.total,
                    byStatus: stats.byStatus
                },
                metadata: {
                    requestId: req.apiId,
                    timestamp: new Date().toISOString(),
                    apiId: 'graphs',
                    executionTime: 0
                }
            };
            res.json(response);
        }
        catch (error) {
            const errorResponse = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown error'
                },
                metadata: {
                    requestId: req.apiId,
                    timestamp: new Date().toISOString(),
                    apiId: 'graphs',
                    executionTime: 0
                }
            };
            res.status(500).json(errorResponse);
        }
    }
};
exports.graphRoutes = graphRoutes;
//# sourceMappingURL=graphs-simple.js.map