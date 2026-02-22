// sinapse graph-viz — Generate Mermaid diagram from graph index
// Story 5.2: nodes, limited to top 30

import { Command } from 'commander';
import { loadGraphIndex } from '../../core/graph.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import type { GraphIndex } from '../../types/index.js';

function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
}

function generateMermaid(graph: GraphIndex, limit: number): string {
  const lines: string[] = ['graph TD'];

  // Get nodes sorted by connection count (descending)
  const nodeEntries = Object.entries(graph.nodes)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit);

  const displayedNodes = new Set(nodeEntries.map(([id]) => id));

  // Node definitions
  for (const [nodeId] of nodeEntries) {
    const label = nodeId.length > 25 ? '...' + nodeId.slice(-22) : nodeId;
    const safeId = sanitizeMermaidId(nodeId);
    lines.push(`  ${safeId}["${label}"]`);
  }

  // Edges
  for (const [nodeId, links] of nodeEntries) {
    for (const link of links) {
      if (!displayedNodes.has(link)) continue;
      const srcId = sanitizeMermaidId(nodeId);
      const tgtId = sanitizeMermaidId(link);
      lines.push(`  ${srcId} --> ${tgtId}`);
    }
  }

  return lines.join('\n');
}

export const graphVizCommand = new Command('graph-viz')
  .description('Generate Mermaid diagram of memory graph')
  .option('--limit <n>', 'Max nodes to show', parseInt, 30)
  .option('--output <file>', 'Save Mermaid source to file')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const graph = loadGraphIndex();

    if (!graph || graph.nodeCount === 0) {
      if (json) {
        console.log(JSON.stringify({ error: 'No graph index found. Run sinapse graph first.' }));
      } else {
        console.log('No graph index found. Run `sinapse graph` first.');
      }
      return;
    }

    const limit = opts.limit ?? 30;
    const mermaid = generateMermaid(graph, limit);

    if (json) {
      console.log(JSON.stringify({
        nodes: graph.nodeCount,
        edges: graph.edgeCount,
        displayed: Math.min(limit, graph.nodeCount),
        mermaid,
      }));
    } else {
      console.log(`\nGraph: ${graph.nodeCount} nodes, ${graph.edgeCount} edges (showing top ${limit})\n`);
      console.log('```mermaid');
      console.log(mermaid);
      console.log('```\n');

      if (opts.output) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(opts.output, mermaid, 'utf-8');
        console.log(`Saved to ${opts.output}`);
      }
    }
  });
