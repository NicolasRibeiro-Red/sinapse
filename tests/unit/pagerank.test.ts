// Tests for PageRank calculator
import { describe, it, expect } from 'vitest';
import type { ImportGraph, CodeGraphNode, CodeGraphEdge } from '../../src/types/index.js';
import { calculatePageRank, getTopFiles } from '../../src/ingest/pagerank.js';

function makeGraph(nodeIds: string[], edges: Array<[string, string]>): ImportGraph {
  const nodes = new Map<string, CodeGraphNode>();
  for (const id of nodeIds) {
    nodes.set(id, {
      id,
      path: `/project/${id}`,
      language: 'typescript',
      imports: [],
      exports: [],
      definitions: [],
      pagerank: 0,
    });
  }
  const graphEdges: CodeGraphEdge[] = edges.map(([source, target]) => ({
    source,
    target,
    type: 'static' as const,
  }));
  return { nodes, edges: graphEdges };
}

describe('calculatePageRank', () => {
  it('returns empty for empty graph', () => {
    const graph = makeGraph([], []);
    const result = calculatePageRank(graph);
    expect(result.scores.size).toBe(0);
    expect(result.converged).toBe(true);
    expect(result.topFiles.length).toBe(0);
  });

  it('single node gets score 1.0', () => {
    const graph = makeGraph(['a.ts'], []);
    const result = calculatePageRank(graph);
    expect(result.scores.get('a.ts')).toBe(1);
  });

  it('hub file gets highest score', () => {
    // a, b, c all import hub — hub should rank highest
    const graph = makeGraph(
      ['hub.ts', 'a.ts', 'b.ts', 'c.ts'],
      [['a.ts', 'hub.ts'], ['b.ts', 'hub.ts'], ['c.ts', 'hub.ts']],
    );
    const result = calculatePageRank(graph);
    const hubScore = result.scores.get('hub.ts')!;
    expect(hubScore).toBe(1); // normalized to 1
    expect(result.scores.get('a.ts')!).toBeLessThan(hubScore);
  });

  it('converges for simple graph', () => {
    const graph = makeGraph(
      ['a.ts', 'b.ts', 'c.ts'],
      [['a.ts', 'b.ts'], ['b.ts', 'c.ts'], ['c.ts', 'a.ts']],
    );
    const result = calculatePageRank(graph);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(50);
  });

  it('damping factor prevents zero scores', () => {
    // d.ts imports nothing and is imported by nobody — should still have score > 0
    const graph = makeGraph(
      ['a.ts', 'b.ts', 'd.ts'],
      [['a.ts', 'b.ts']],
    );
    const result = calculatePageRank(graph);
    expect(result.scores.get('d.ts')!).toBeGreaterThan(0);
  });

  it('returns topFiles sorted descending', () => {
    const graph = makeGraph(
      ['hub.ts', 'a.ts', 'b.ts', 'c.ts'],
      [['a.ts', 'hub.ts'], ['b.ts', 'hub.ts'], ['c.ts', 'hub.ts']],
    );
    const result = calculatePageRank(graph);
    for (let i = 1; i < result.topFiles.length; i++) {
      expect(result.topFiles[i - 1].score).toBeGreaterThanOrEqual(result.topFiles[i].score);
    }
  });

  it('updates node pagerank values in graph', () => {
    const graph = makeGraph(
      ['hub.ts', 'a.ts'],
      [['a.ts', 'hub.ts']],
    );
    calculatePageRank(graph);
    expect(graph.nodes.get('hub.ts')!.pagerank).toBeGreaterThan(0);
    expect(graph.nodes.get('a.ts')!.pagerank).toBeGreaterThan(0);
  });

  it('handles circular dependencies', () => {
    const graph = makeGraph(
      ['a.ts', 'b.ts'],
      [['a.ts', 'b.ts'], ['b.ts', 'a.ts']],
    );
    const result = calculatePageRank(graph);
    expect(result.converged).toBe(true);
    // Both should have same score (symmetric)
    expect(result.scores.get('a.ts')).toBeCloseTo(result.scores.get('b.ts')!, 2);
  });

  it('handles star topology', () => {
    const ids = ['center.ts', 'l1.ts', 'l2.ts', 'l3.ts', 'l4.ts', 'l5.ts'];
    const edges: Array<[string, string]> = ids.slice(1).map(id => [id, 'center.ts']);
    const graph = makeGraph(ids, edges);
    const result = calculatePageRank(graph);
    expect(result.topFiles[0].path).toBe('center.ts');
  });
});

describe('getTopFiles', () => {
  it('returns top N files sorted by pagerank', () => {
    const graph = makeGraph(
      ['a.ts', 'b.ts', 'c.ts'],
      [['a.ts', 'b.ts'], ['a.ts', 'c.ts'], ['b.ts', 'c.ts']],
    );
    calculatePageRank(graph);
    const top = getTopFiles(graph, 2);
    expect(top.length).toBe(2);
    expect(top[0].pagerank).toBeGreaterThanOrEqual(top[1].pagerank);
  });
});
