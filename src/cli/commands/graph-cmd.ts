// sinapse graph — Rebuild graph index from memory links

import { Command } from 'commander';
import { buildGraphIndex, saveGraphIndex } from '../../core/graph.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const graphCommand = new Command('graph')
  .description('Rebuild graph index from memory links')
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const index = buildGraphIndex();
    saveGraphIndex(index);

    if (json) {
      console.log(JSON.stringify({
        nodes: index.nodeCount,
        edges: index.edgeCount,
        updatedAt: index.updatedAt,
      }));
    } else {
      console.log(`sinapse graph: ${index.nodeCount} nodes, ${index.edgeCount} edges`);
    }
  });
