// sinapse list — List memories with filters

import { Command } from 'commander';
import { listMemories } from '../../core/memory-store.js';
import { ensureDirectoryStructure } from '../../core/namespace.js';
import type { MemoryType, MemoryStatus } from '../../types/index.js';

export const listCommand = new Command('list')
  .description('List memories with optional filters')
  .option('--agent <agent>', 'Filter by agent')
  .option('--project <project>', 'Filter by project')
  .option('--type <type>', 'Filter by type')
  .option('--status <status>', 'Filter by status')
  .option('--min-score <score>', 'Minimum effective score', parseFloat)
  .option('--limit <n>', 'Max results', parseInt)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent?.opts() ?? {};
    const json = globalOpts.json ?? false;

    ensureDirectoryStructure();

    const memories = listMemories({
      agent: opts.agent,
      project: opts.project,
      type: opts.type as MemoryType | undefined,
      status: opts.status as MemoryStatus | undefined,
      minScore: opts.minScore,
      limit: opts.limit,
    });

    if (json) {
      console.log(JSON.stringify(memories.map(m => ({
        id: m.id,
        title: m.title,
        importance: m.importance,
        effective_score: m.effective_score,
        agent: m.agent,
        project: m.project,
        type: m.type,
        status: m.status,
        tags: m.tags,
      }))));
    } else {
      if (memories.length === 0) {
        console.log('No memories found.');
        return;
      }

      console.log(`\n┌─────────────────────┬──────┬───────┬──────────┬──────────┬────────┐`);
      console.log(`│ ID                  │ Imp  │ Score │ Agent    │ Type     │ Status │`);
      console.log(`├─────────────────────┼──────┼───────┼──────────┼──────────┼────────┤`);

      for (const mem of memories) {
        const shortId = mem.id.length > 19 ? mem.id.slice(0, 19) : mem.id;
        console.log(
          `│ ${shortId.padEnd(19)} │ ${String(mem.importance).padStart(4)} │ ${mem.effective_score.toFixed(1).padStart(5)} │ ${mem.agent.padEnd(8).slice(0, 8)} │ ${mem.type.padEnd(8).slice(0, 8)} │ ${mem.status.padEnd(6).slice(0, 6)} │`
        );
      }

      console.log(`└─────────────────────┴──────┴───────┴──────────┴──────────┴────────┘`);
      console.log(`Total: ${memories.length} memories\n`);
    }
  });
