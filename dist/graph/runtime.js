"use strict";
// ------------------------------------------------------------------
// Graph Execution Runtime
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRuntime = void 0;
exports.validateGraph = validateGraph;
const execution_1 = require("../execution");
const plans_1 = require("../plans");
// ------------------------------------------------------------------
// Graph Runtime Class
// ------------------------------------------------------------------
class GraphRuntime {
    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    async execute(graph, options) {
        const opts = this.mergeOptions(options);
        // STEP 1: Validate the graph
        const validation = await this.validateGraph(graph);
        if (!validation.valid) {
            return {
                graphId: graph.id,
                success: false,
                nodeResults: new Map(),
                finalOutput: null,
                totalExecutionTime: 0,
                failedNode: 'validation'
            };
        }
        // If dry run, return after validation
        if (opts.dryRun) {
            return {
                graphId: graph.id,
                success: true,
                nodeResults: new Map(),
                finalOutput: null,
                totalExecutionTime: 0
            };
        }
        const startTime = Date.now();
        const nodeResults = new Map();
        try {
            // STEP 2: Topological sort
            const executionOrder = this.topologicalSort(graph);
            // STEP 3: Execute nodes
            await this.executeNodes(graph, executionOrder, nodeResults, opts);
            // STEP 4: Collect results
            return this.buildResult(graph, nodeResults, Date.now() - startTime, opts);
        }
        catch (error) {
            return {
                graphId: graph.id,
                success: false,
                nodeResults,
                finalOutput: null,
                totalExecutionTime: Date.now() - startTime,
                failedNode: 'runtime_error'
            };
        }
    }
    // ------------------------------------------------------------------
    // STEP 1: Graph Validation
    // ------------------------------------------------------------------
    async validateGraph(graph) {
        const errors = [];
        const warnings = [];
        // Check for duplicate node IDs
        const nodeIds = new Set();
        for (const node of graph.nodes) {
            if (nodeIds.has(node.id)) {
                errors.push({
                    nodeId: node.id,
                    message: `Duplicate node ID: ${node.id}`,
                    severity: 'error'
                });
            }
            nodeIds.add(node.id);
        }
        // Check entryNode exists
        if (!nodeIds.has(graph.entryNode)) {
            errors.push({
                message: `Entry node ${graph.entryNode} does not exist in nodes array`,
                severity: 'error'
            });
        }
        // Check edge references
        for (const edge of graph.edges) {
            if (!nodeIds.has(edge.from)) {
                errors.push({
                    edgeId: `${edge.from}->${edge.to}`,
                    message: `Edge from node ${edge.from} which does not exist`,
                    severity: 'error'
                });
            }
            if (!nodeIds.has(edge.to)) {
                errors.push({
                    edgeId: `${edge.from}->${edge.to}`,
                    message: `Edge to node ${edge.to} which does not exist`,
                    severity: 'error'
                });
            }
        }
        // Check for cycles (topological sort will fail if cycles exist)
        try {
            this.topologicalSort(graph);
        }
        catch (error) {
            errors.push({
                message: `Graph contains cycles: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'error'
            });
        }
        // Node-specific validation
        for (const node of graph.nodes) {
            // Condition nodes must have both branches
            if (node.type === 'condition') {
                if (!node.trueBranch || !node.falseBranch) {
                    errors.push({
                        nodeId: node.id,
                        message: 'Condition node must have both trueBranch and falseBranch',
                        severity: 'error'
                    });
                }
            }
            // Query nodes must have a plan
            if (node.type === 'query' && !node.plan) {
                errors.push({
                    nodeId: node.id,
                    message: 'Query node must have a plan',
                    severity: 'error'
                });
            }
            // Transform nodes must have a transform function
            if (node.type === 'transform' && !node.transform) {
                errors.push({
                    nodeId: node.id,
                    message: 'Transform node must have a transform function',
                    severity: 'error'
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    // ------------------------------------------------------------------
    // STEP 2: Topological Sort
    // ------------------------------------------------------------------
    topologicalSort(graph) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const inDegree = new Map();
        const adjList = new Map();
        // Initialize
        for (const node of graph.nodes) {
            inDegree.set(node.id, 0);
            adjList.set(node.id, []);
        }
        // Build adjacency list and calculate in-degrees
        for (const edge of graph.edges) {
            adjList.get(edge.from)?.push(edge.to);
            inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
        }
        // Queue of nodes with no incoming edges
        const queue = [];
        for (const [nodeId, degree] of inDegree) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }
        const result = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const node = nodeMap.get(current);
            if (node) {
                result.push(node);
            }
            // Process neighbors
            for (const neighbor of adjList.get(current) || []) {
                const newDegree = (inDegree.get(neighbor) || 0) - 1;
                inDegree.set(neighbor, newDegree);
                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }
        // If we didn't process all nodes, there's a cycle
        if (result.length !== graph.nodes.length) {
            throw new Error('Graph contains cycles');
        }
        return result;
    }
    // ------------------------------------------------------------------
    // STEP 3: Execute Nodes
    // ------------------------------------------------------------------
    async executeNodes(graph, executionOrder, nodeResults, options) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const completedNodes = new Set();
        // Group nodes by dependency level for parallel execution
        const levels = this.groupByDependencyLevel(executionOrder, graph);
        for (const level of levels) {
            // Execute nodes in this level in parallel (up to maxParallelNodes)
            const chunks = this.chunkArray(level, options.maxParallelNodes || 5);
            for (const chunk of chunks) {
                const promises = chunk.map(async (node) => {
                    return this.executeNode(node, nodeMap, graph, nodeResults, completedNodes, options);
                });
                await Promise.all(promises);
                // Mark all nodes in this chunk as completed
                chunk.forEach(node => completedNodes.add(node.id));
            }
        }
    }
    async executeNode(node, nodeMap, graph, nodeResults, completedNodes, options) {
        // Check if this node was already marked as skipped
        const existingResult = nodeResults.get(node.id);
        if (existingResult?.skipped) {
            completedNodes.add(node.id);
            return;
        }
        const startTime = Date.now();
        const timeout = node.timeoutMs ?? options.timeoutMs ?? 30000;
        try {
            // Collect inputs from incoming edges
            const input = this.collectNodeInputs(node, graph, nodeResults, completedNodes);
            let result;
            switch (node.type) {
                case 'query':
                    result = await this.executeQueryNode(node, input, timeout);
                    break;
                case 'transform':
                    result = await this.executeTransformNode(node, input, timeout);
                    break;
                case 'condition':
                    result = await this.executeConditionNode(node, input, timeout, nodeResults, graph);
                    break;
                case 'notify':
                    result = await this.executeNotifyNode(node, input, timeout);
                    break;
                default:
                    throw new Error(`Unknown node type: ${node.type}`);
            }
            nodeResults.set(node.id, {
                nodeId: node.id,
                success: true,
                data: result,
                executionTime: Date.now() - startTime
            });
            // Mark node as completed for dependency tracking
            completedNodes.add(node.id);
        }
        catch (error) {
            const nodeResult = {
                nodeId: node.id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime: Date.now() - startTime
            };
            nodeResults.set(node.id, nodeResult);
            // Even failed nodes are considered completed for dependency tracking
            completedNodes.add(node.id);
            if (options.stopOnFirstError) {
                throw error;
            }
        }
    }
    // ------------------------------------------------------------------
    // Node Type Execution Methods
    // ------------------------------------------------------------------
    async executeQueryNode(node, input, timeout) {
        if (!node.plan) {
            throw new Error('Query node missing plan');
        }
        // Validate plan (should already be valid, but double-check)
        const validation = (0, plans_1.validatePlan)(node.plan);
        if (!validation.valid) {
            throw new Error(`Invalid plan: ${validation.issues.map(i => i.message).join(', ')}`);
        }
        // Compile and execute
        const compiled = (0, execution_1.compileQuery)(node.plan);
        const result = await this.withTimeout((0, execution_1.executeCompiledQuery)(compiled), timeout);
        return result.data;
    }
    async executeTransformNode(node, input, timeout) {
        if (!node.transform) {
            throw new Error('Transform node missing transform function');
        }
        return this.withTimeout(Promise.resolve(node.transform(input)), timeout);
    }
    async executeConditionNode(node, input, timeout, nodeResults, graph) {
        if (!node.condition) {
            throw new Error('Condition node missing condition function');
        }
        const result = await this.withTimeout(Promise.resolve(node.condition(input)), timeout);
        // Immediately mark the appropriate branch as skipped BEFORE execution
        if (result && node.trueBranch) {
            if (node.falseBranch) {
                this.markSubgraphSkipped(node.falseBranch, graph, nodeResults);
            }
        }
        else if (!result && node.falseBranch) {
            if (node.trueBranch) {
                this.markSubgraphSkipped(node.trueBranch, graph, nodeResults);
            }
        }
        return result;
    }
    async executeNotifyNode(node, input, timeout) {
        // Call node's notify function if it exists
        const result = node.notify
            ? await this.withTimeout(Promise.resolve(node.notify(input)), timeout)
            : input; // passthrough if no function
        return result;
    }
    // ------------------------------------------------------------------
    // Helper Methods
    // ------------------------------------------------------------------
    collectNodeInputs(node, graph, nodeResults, completedNodes) {
        const input = {};
        // Find all edges pointing TO this node
        const incomingEdges = graph.edges.filter(e => e.to === node.id);
        for (const edge of incomingEdges) {
            const sourceResult = nodeResults.get(edge.from);
            if (!sourceResult?.success || sourceResult.skipped)
                continue;
            if (edge.dataKey) {
                // Named input — e.g. input.customers
                input[edge.dataKey] = sourceResult.data;
            }
            else {
                // Unnamed — merge directly into input
                if (typeof sourceResult.data === 'object' && !Array.isArray(sourceResult.data)) {
                    Object.assign(input, sourceResult.data);
                }
                else {
                    // Array or primitive — store under source node id
                    input[edge.from] = sourceResult.data;
                }
            }
        }
        return input;
    }
    markSubgraphSkipped(startNodeId, graph, nodeResults) {
        const toSkip = new Set();
        const queue = [startNodeId];
        while (queue.length > 0) {
            const current = queue.shift();
            if (toSkip.has(current))
                continue;
            toSkip.add(current);
            // add all downstream nodes
            graph.edges
                .filter(e => e.from === current)
                .forEach(e => queue.push(e.to));
        }
        for (const nodeId of toSkip) {
            if (!nodeResults.has(nodeId)) {
                nodeResults.set(nodeId, {
                    nodeId,
                    success: true,
                    skipped: true,
                    executionTime: 0
                });
            }
        }
    }
    groupByDependencyLevel(executionOrder, graph) {
        const levels = [];
        const processed = new Set();
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const edgeMap = new Map();
        // Build edge map
        for (const edge of graph.edges) {
            if (!edgeMap.has(edge.to)) {
                edgeMap.set(edge.to, []);
            }
            edgeMap.get(edge.to).push(edge.from);
        }
        const remaining = new Set(executionOrder.map(n => n.id));
        while (remaining.size > 0) {
            const currentLevel = [];
            const toRemove = [];
            for (const nodeId of remaining) {
                const dependencies = edgeMap.get(nodeId) || [];
                if (dependencies.every(dep => processed.has(dep))) {
                    currentLevel.push(nodeMap.get(nodeId));
                    toRemove.push(nodeId);
                }
            }
            if (currentLevel.length === 0) {
                throw new Error('Circular dependency detected');
            }
            levels.push(currentLevel);
            toRemove.forEach(id => {
                remaining.delete(id);
                processed.add(id);
            });
        }
        return levels;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
            })
        ]);
    }
    mergeOptions(options) {
        return {
            maxParallelNodes: options?.maxParallelNodes ?? 5,
            timeoutMs: options?.timeoutMs ?? 30000,
            stopOnFirstError: options?.stopOnFirstError ?? true,
            dryRun: options?.dryRun ?? false
        };
    }
    // ------------------------------------------------------------------
    // STEP 4: Collect Results
    // ------------------------------------------------------------------
    buildResult(graph, nodeResults, totalExecutionTime, options) {
        const successfulNodes = Array.from(nodeResults.values()).filter(r => r.success);
        const failedNodes = Array.from(nodeResults.values()).filter(r => !r.success && !r.skipped);
        // Find the last executed node (node with no outgoing edges or last in order)
        const finalOutput = this.findFinalOutput(graph, nodeResults);
        return {
            graphId: graph.id,
            success: failedNodes.length === 0,
            nodeResults,
            finalOutput,
            totalExecutionTime,
            failedNode: failedNodes.length > 0 ? failedNodes[0].nodeId : undefined
        };
    }
    findFinalOutput(graph, nodeResults) {
        // Find nodes with no outgoing edges
        const nodesWithOutgoingEdges = new Set();
        for (const edge of graph.edges) {
            nodesWithOutgoingEdges.add(edge.from);
        }
        // Find terminal nodes
        const terminalNodes = graph.nodes.filter(n => !nodesWithOutgoingEdges.has(n.id));
        // Return the data from the first successful terminal node
        for (const node of terminalNodes) {
            const result = nodeResults.get(node.id);
            if (result?.success && result.data !== undefined) {
                return result.data;
            }
        }
        // Fallback: return data from last successful node
        const successfulResults = Array.from(nodeResults.values())
            .filter(r => r.success && r.data !== undefined)
            .reverse();
        return successfulResults.length > 0 ? successfulResults[0].data : null;
    }
}
exports.GraphRuntime = GraphRuntime;
// ------------------------------------------------------------------
// Standalone Validation Function
// ------------------------------------------------------------------
async function validateGraph(graph) {
    const runtime = new GraphRuntime();
    return runtime.validateGraph(graph);
}
//# sourceMappingURL=runtime.js.map