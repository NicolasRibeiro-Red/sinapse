import { describe, it, expect } from 'vitest';
import { buildGraphIndex, getConnections } from '../../src/core/graph.js';
import { MemoryStatus, MemoryType } from '../../src/types/index.js';
import type { SinapseMemory } from '../../src/types/index.js';

function makeMem(id: string, links: string[] = [], supersedes: string | null = null): SinapseMemory {
  const now = new Date().toISOString();
  return {
    id,
    importance: 7,
    agent: 'dev',
    project: 'test',
    tags: [],
    type: MemoryType.Context,
    created: now,
    updated: now,
    accessed: now,
    access_count: 0,
    decay_rate: 0.995,
    effective_score: 7,
    status: MemoryStatus.Active,
    links,
    supersedes,
    title: `Memory ${id}`,
    content: 'Content',
    filePath: `/tmp/${id}.md`,
  };
}

describe('Graph Index', () => {
  describe('buildGraphIndex', () => {
    it('builds empty graph from empty memories', () => {
      const index = buildGraphIndex([]);
      expect(index.nodeCount).toBe(0);
      expect(index.edgeCount).toBe(0);
    });

    it('builds graph from memory links', () => {
      const memories = [
        makeMem('mem-1', ['mem-2', 'mem-3']),
        makeMem('mem-2', ['mem-3']),
        makeMem('mem-3'),
      ];
      const index = buildGraphIndex(memories);
      expect(index.nodeCount).toBe(3);
      expect(index.edgeCount).toBe(3);
      expect(index.nodes['mem-1']).toContain('mem-2');
      expect(index.nodes['mem-1']).toContain('mem-3');
      expect(index.nodes['mem-2']).toContain('mem-3');
    });

    it('includes supersedes as edges', () => {
      const memories = [
        makeMem('mem-2', [], 'mem-1'),
        makeMem('mem-1'),
      ];
      const index = buildGraphIndex(memories);
      expect(index.nodes['mem-2']).toContain('mem-1');
      expect(index.edgeCount).toBe(1);
    });

    it('handles orphan links (linked memory not in set)', () => {
      const memories = [
        makeMem('mem-1', ['mem-999']),
      ];
      const index = buildGraphIndex(memories);
      expect(index.nodeCount).toBe(2); // mem-1 + mem-999 (orphan)
      expect(index.nodes['mem-999']).toEqual([]);
    });

    it('no duplicate edges', () => {
      const memories = [
        makeMem('mem-1', ['mem-2', 'mem-2', 'mem-2']),
      ];
      const index = buildGraphIndex(memories);
      expect(index.nodes['mem-1']!.length).toBe(1);
      expect(index.edgeCount).toBe(1);
    });
  });

  describe('getConnections', () => {
    it('finds direct connections (depth 1)', () => {
      const index = buildGraphIndex([
        makeMem('A', ['B', 'C']),
        makeMem('B', ['D']),
        makeMem('C'),
        makeMem('D'),
      ]);

      const connections = getConnections(index, 'A', 1);
      expect(connections).toContain('B');
      expect(connections).toContain('C');
      expect(connections).not.toContain('D');
    });

    it('finds transitive connections (depth 2)', () => {
      const index = buildGraphIndex([
        makeMem('A', ['B']),
        makeMem('B', ['C']),
        makeMem('C', ['D']),
        makeMem('D'),
      ]);

      const connections = getConnections(index, 'A', 2);
      expect(connections).toContain('B');
      expect(connections).toContain('C');
      expect(connections).not.toContain('D');
    });

    it('finds reverse connections', () => {
      const index = buildGraphIndex([
        makeMem('A', ['B']),
        makeMem('B'),
      ]);

      // B should find A as reverse connection
      const connections = getConnections(index, 'B', 1);
      expect(connections).toContain('A');
    });

    it('returns empty for isolated node', () => {
      const index = buildGraphIndex([makeMem('A')]);
      const connections = getConnections(index, 'A', 1);
      expect(connections).toHaveLength(0);
    });
  });
});
