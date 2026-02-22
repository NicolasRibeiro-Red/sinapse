// Integration test: Graph integrity
// Builds graph index from memories and verifies traversal

import { describe, it, expect } from 'vitest';
import { buildGraphIndex, getConnections } from '../../src/core/graph.js';
import type { SinapseMemory } from '../../src/types/index.js';



function makeMem(id: string, links: string[] = [], supersedes?: string): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id,
    title: `Memory ${id}`,
    type: 'Decision' as any,
    importance: 7,
    effective_score: 7,
    decay_rate: 0.995,
    status: 'Active' as any,
    agent: 'dev',
    project: 'test',
    tags: ['test'],
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    links,
    supersedes: supersedes ?? null,
    content: `Content for ${id}`,
    filePath: '',
  };
}

describe('Graph Integrity E2E', () => {
  it('builds graph with correct node count', () => {
    const memories = [
      makeMem('mem-A', ['mem-B', 'mem-D']),
      makeMem('mem-B', ['mem-C']),
      makeMem('mem-C'),
      makeMem('mem-D'),
      makeMem('mem-E', [], 'mem-B'),
    ];

    const graph = buildGraphIndex(memories);
    expect(graph.nodeCount).toBe(5);
  });

  it('builds correct edges from links', () => {
    const memories = [
      makeMem('mem-A', ['mem-B', 'mem-D']),
      makeMem('mem-B', ['mem-C']),
      makeMem('mem-C'),
      makeMem('mem-D'),
      makeMem('mem-E', [], 'mem-B'),
    ];

    const graph = buildGraphIndex(memories);
    // A→B, A→D, B→C, E→B (supersedes)
    expect(graph.edgeCount).toBe(4);
  });

  it('traverses connections at depth 1', () => {
    const memories = [
      makeMem('mem-A', ['mem-B', 'mem-D']),
      makeMem('mem-B', ['mem-C']),
      makeMem('mem-C'),
      makeMem('mem-D'),
    ];

    const graph = buildGraphIndex(memories);
    const connections = getConnections(graph, 'mem-A', 1);
    expect(connections).toContain('mem-B');
    expect(connections).toContain('mem-D');
  });

  it('traverses connections at depth 2', () => {
    const memories = [
      makeMem('mem-A', ['mem-B']),
      makeMem('mem-B', ['mem-C']),
      makeMem('mem-C'),
    ];

    const graph = buildGraphIndex(memories);
    const connections = getConnections(graph, 'mem-A', 2);
    expect(connections).toContain('mem-B');
    expect(connections).toContain('mem-C');
  });

  it('includes reverse connections', () => {
    const memories = [
      makeMem('mem-A', ['mem-B']),
      makeMem('mem-B'),
    ];

    const graph = buildGraphIndex(memories);
    // getConnections finds both forward and reverse by default
    const connections = getConnections(graph, 'mem-B', 1);
    expect(connections).toContain('mem-A');
  });

  it('handles isolated nodes', () => {
    const memories = [
      makeMem('mem-alone'),
    ];

    const graph = buildGraphIndex(memories);
    expect(graph.nodeCount).toBe(1);
    const connections = getConnections(graph, 'mem-alone', 1);
    expect(connections.length).toBe(0);
  });
});
