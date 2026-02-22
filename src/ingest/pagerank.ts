// Sinapse — PageRank Calculator
// Simplified PageRank over import graph
// Damping: 0.85, Max iterations: 50, Convergence: 1e-6

import type { ImportGraph } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/config.js';

export interface PageRankResult {
  scores: Map<string, number>;
  iterations: number;
  converged: boolean;
  topFiles: Array<{ path: string; score: number }>;
}

export function calculatePageRank(graph: ImportGraph): PageRankResult {
  const config = DEFAULT_CONFIG.ingest;
  const { pagerankDamping: d, pagerankMaxIter: maxIter, pagerankConvergence: epsilon } = config;

  const nodeIds = Array.from(graph.nodes.keys());
  const n = nodeIds.length;

  if (n === 0) {
    return { scores: new Map(), iterations: 0, converged: true, topFiles: [] };
  }

  // Build adjacency: who links TO each node (incoming edges)
  const incomingMap = new Map<string, string[]>();
  const outDegree = new Map<string, number>();

  for (const id of nodeIds) {
    incomingMap.set(id, []);
    outDegree.set(id, 0);
  }

  for (const edge of graph.edges) {
    // edge.source imports edge.target
    // In PageRank terms: source links to target → target gets authority
    const incoming = incomingMap.get(edge.target);
    if (incoming) {
      incoming.push(edge.source);
    }

    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
  }

  // Initialize scores
  let scores = new Map<string, number>();
  const initialScore = 1 / n;
  for (const id of nodeIds) {
    scores.set(id, initialScore);
  }

  // Iterate
  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations++;
    const newScores = new Map<string, number>();
    let maxDiff = 0;

    for (const id of nodeIds) {
      let sum = 0;
      const incoming = incomingMap.get(id) ?? [];

      for (const src of incoming) {
        const srcScore = scores.get(src) ?? 0;
        const srcOutDeg = outDegree.get(src) ?? 1;
        sum += srcScore / srcOutDeg;
      }

      const newScore = (1 - d) / n + d * sum;
      newScores.set(id, newScore);

      const diff = Math.abs(newScore - (scores.get(id) ?? 0));
      if (diff > maxDiff) maxDiff = diff;
    }

    scores = newScores;

    if (maxDiff < epsilon) {
      converged = true;
      break;
    }
  }

  // Normalize to 0-1
  let maxScore = 0;
  for (const score of scores.values()) {
    if (score > maxScore) maxScore = score;
  }

  if (maxScore > 0) {
    for (const [id, score] of scores) {
      scores.set(id, score / maxScore);
    }
  }

  // Update node pagerank values
  for (const [id, node] of graph.nodes) {
    node.pagerank = scores.get(id) ?? 0;
  }

  // Get top files
  const topFiles = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.topFilesCount)
    .map(([path, score]) => ({ path, score: Math.round(score * 1000) / 1000 }));

  return { scores, iterations, converged, topFiles };
}

export function getTopFiles(graph: ImportGraph, count: number = 20): Array<{ path: string; pagerank: number }> {
  return Array.from(graph.nodes.values())
    .sort((a, b) => b.pagerank - a.pagerank)
    .slice(0, count)
    .map(n => ({ path: n.id, pagerank: Math.round(n.pagerank * 1000) / 1000 }));
}
