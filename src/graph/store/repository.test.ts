// ------------------------------------------------------------------
// Graph Repository Tests
// ------------------------------------------------------------------

import { GraphRepository } from './repository';
import { ExecutionGraph, ExecutionNode } from '../types';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { GraphStatus, CreateGraphInput } from './types';

// ------------------------------------------------------------------
// Test Setup
// ------------------------------------------------------------------

// Mock the graph database
jest.mock('./db', () => ({
  getGraphDatabase: jest.fn()
}));

import { getGraphDatabase } from './db';

describe('GraphRepository', () => {
  let repository: GraphRepository;
  let mockDb: Database;
  
  // Helper to create a fresh repository with in-memory database for each test
  async function createFreshRepository(): Promise<GraphRepository> {
    // Create in-memory database
    mockDb = await open({
      filename: ':memory:',
      driver: sqlite3.Database
    });
    
    // Mock the getGraphDatabase function to return our in-memory database
    (getGraphDatabase as jest.Mock).mockResolvedValue(mockDb);
    
    // Create a new GraphRepository instance
    const repo = new GraphRepository();
    
    return repo;
  }
  
  // Helper to create test graph data
  function createTestGraph(overrides: Partial<CreateGraphInput> = {}): CreateGraphInput {
    const testNode: ExecutionNode = {
      id: 'test-node-1',
      type: 'query',
      label: 'Test Query Node'
    };
    
    const testGraph: ExecutionGraph = {
      id: 'test-graph-1',
      label: 'Test Graph',
      nodes: [testNode],
      edges: [],
      entryNode: 'test-node-1'
    };
    
    return {
      prompt: 'Test prompt',
      graph: testGraph,
      generationMs: 100,
      executionMs: 200,
      success: true,
      ...overrides
    };
  }
  
  beforeEach(async () => {
    // Clear any previous mocks
    jest.clearAllMocks();
    repository = await createFreshRepository();
  });
  
  afterEach(async () => {
    // Clean up database connection
    if (mockDb) {
      await mockDb.close();
    }
  });

  // ------------------------------------------------------------------
  // Tests
  // ------------------------------------------------------------------

  it('saves a graph and returns StoredGraph with id', async () => {
    const input = createTestGraph();
    
    const result = await repository.save(input);
    
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.prompt).toBe(input.prompt);
    expect(result.status).toBe('draft');
    expect(result.generationMs).toBe(input.generationMs);
    expect(result.executionMs).toBe(input.executionMs);
    expect(result.success).toBe(input.success);
    expect(result.nodeCount).toBe(1);
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBeGreaterThan(0);
  });

  it('findById returns null for unknown id', async () => {
    const result = await repository.findById('unknown-id');
    
    expect(result).toBeNull();
  });

  it('findById returns graph after save', async () => {
    const input = createTestGraph();
    const saved = await repository.save(input);
    
    const result = await repository.findById(saved.id);
    
    expect(result).toBeDefined();
    expect(result!.id).toBe(saved.id);
    expect(result!.prompt).toBe(input.prompt);
    expect(result!.status).toBe('draft');
  });

  it('graphJson is stored as string, not parsed object', async () => {
    const input = createTestGraph();
    const saved = await repository.save(input);
    
    // Verify graphJson is a string
    expect(typeof saved.graphJson).toBe('string');
    
    // Verify it can be parsed back to the original graph
    const parsedGraph = JSON.parse(saved.graphJson);
    expect(parsedGraph.id).toBe(input.graph.id);
    expect(parsedGraph.nodes).toHaveLength(1);
    expect(parsedGraph.nodes[0].id).toBe('test-node-1');
  });

  it('updateStatus changes status and sets updatedAt', async () => {
    const input = createTestGraph();
    const saved = await repository.save(input);
    const originalUpdatedAt = saved.updatedAt;
    
    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const updated = await repository.updateStatus({
      id: saved.id,
      status: 'approved',
      approvedBy: 'test-user',
      approvalNote: 'Test approval'
    });
    
    expect(updated.status).toBe('approved');
    expect(updated.approvedBy).toBe('test-user');
    expect(updated.approvalNote).toBe('Test approval');
    expect(updated.updatedAt).toBeGreaterThan(originalUpdatedAt);
  });

  it('updateStatus throws for unknown id', async () => {
    await expect(
      repository.updateStatus({
        id: 'unknown-id',
        status: 'approved'
      })
    ).rejects.toThrow();
  });

  it('incrementUsage increments executionCount', async () => {
    const input = createTestGraph();
    const saved = await repository.save(input);
    const originalCount = saved.executionCount;
    
    await repository.incrementUsage(saved.id);
    
    const updated = await repository.findById(saved.id);
    expect(updated!.executionCount).toBe(originalCount + 1);
    expect(updated!.lastUsedAt).toBeGreaterThan(0);
  });

  it('query filters by status', async () => {
    const input = createTestGraph();
    const draft1 = await repository.save(input);
    const draft2 = await repository.save(input);
    
    // Approve one graph
    await repository.updateStatus({ id: draft1.id, status: 'approved' });
    
    // Query for draft graphs
    const drafts = await repository.query({ status: 'draft' });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].id).toBe(draft2.id);
    
    // Query for approved graphs
    const approved = await repository.query({ status: 'approved' });
    expect(approved).toHaveLength(1);
    expect(approved[0].id).toBe(draft1.id);
  });

  it('query filters by promptContains using FTS', async () => {
    const input1 = createTestGraph({ prompt: 'Find all users named John' });
    const input2 = createTestGraph({ prompt: 'List all orders from yesterday' });
    const input3 = createTestGraph({ prompt: 'Search for John Doe users' });
    
    await repository.save(input1);
    await repository.save(input2);
    await repository.save(input3);
    
    // Search for 'John'
    const johnResults = await repository.query({ promptContains: 'John' });
    expect(johnResults).toHaveLength(2);
    
    // Search for 'orders'
    const orderResults = await repository.query({ promptContains: 'orders' });
    expect(orderResults).toHaveLength(1);
  });

  it('query returns results ordered by created_at DESC', async () => {
    const input = createTestGraph();
    
    const graph1 = await repository.save(input);
    // Wait to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    const graph2 = await repository.save(input);
    await new Promise(resolve => setTimeout(resolve, 10));
    const graph3 = await repository.save(input);
    
    const results = await repository.query({});
    
    expect(results).toHaveLength(3);
    expect(results[0].id).toBe(graph3.id); // Most recent first
    expect(results[1].id).toBe(graph2.id);
    expect(results[2].id).toBe(graph1.id); // Oldest last
  });

  it('stats returns correct counts by status', async () => {
    const input = createTestGraph();
    
    // Save multiple graphs with different statuses
    const graph1 = await repository.save(input);
    const graph2 = await repository.save(input);
    const graph3 = await repository.save(input);
    const graph4 = await repository.save(input);
    
    // Update statuses
    await repository.updateStatus({ id: graph1.id, status: 'approved' });
    await repository.updateStatus({ id: graph2.id, status: 'approved' });
    await repository.updateStatus({ id: graph3.id, status: 'rejected' });
    // graph4 remains draft
    
    const stats = await repository.stats();
    
    expect(stats.total).toBe(4);
    expect(stats.byStatus.draft).toBe(1);
    expect(stats.byStatus.approved).toBe(2);
    expect(stats.byStatus.rejected).toBe(1);
    expect(stats.byStatus.deprecated).toBe(0);
  });

  it('save with success: false stores errorMessage', async () => {
    const input = createTestGraph({
      success: false,
      errorMessage: 'Test error message'
    });
    
    const result = await repository.save(input);
    
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Test error message');
    
    // Verify it persists when retrieved
    const retrieved = await repository.findById(result.id);
    expect(retrieved!.success).toBe(false);
    expect(retrieved!.errorMessage).toBe('Test error message');
  });
});
