// sinapse export — Export all memories to JSON

import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { listMemories } from '../../core/memory-store.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';

export const exportCommand = new Command('export')
  .description('Export all memories to JSON')
  .option('--output <path>', 'Output file path', 'sinapse-export.json')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();
    const memories = listMemories();

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '0.1.0',
      totalMemories: memories.length,
      memories: memories.map(m => ({
        id: m.id,
        importance: m.importance,
        agent: m.agent,
        project: m.project,
        tags: m.tags,
        type: m.type,
        created: m.created,
        updated: m.updated,
        accessed: m.accessed,
        access_count: m.access_count,
        decay_rate: m.decay_rate,
        effective_score: m.effective_score,
        status: m.status,
        links: m.links,
        supersedes: m.supersedes,
        title: m.title,
        content: m.content,
      })),
    };

    writeFileSync(opts.output, JSON.stringify(exportData, null, 2), 'utf-8');

    if (json) {
      console.log(JSON.stringify({ exported: memories.length, output: opts.output }));
    } else {
      console.log(`sinapse export: ${memories.length} memories exported to ${opts.output}`);
    }
  });
